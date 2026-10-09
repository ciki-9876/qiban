package io.github.ciki9876.qiban.dev;

import static org.junit.Assert.*;
import android.content.Context;
import android.graphics.Bitmap;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Only run in a newly created CI AVD. No cloud login or real credential is used. */
@RunWith(AndroidJUnit4.class)
public class AndroidSmokeTest {
    @Test public void bundledLoginAndIndependentEncryptedFixture() throws Exception {
        assertEquals("Use a new isolated CI AVD", "true", InstrumentationRegistry.getArguments().getString("qibanIsolatedAvd"));
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File vault = new File(context.getNoBackupFilesDir(), "qiban-encrypted");
        assertFalse("A device with an existing session must never be used", new File(vault, "session.sealed").exists());
        JSONObject report = new JSONObject().put("fixtureOnly", true).put("realCredentialsUsed", false);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<QibanNativePlugin> plugin = new AtomicReference<>();
            scenario.onActivity(activity -> plugin.set((QibanNativePlugin)activity.getBridge().getPlugin("QibanNative").getInstance()));
            assertNotNull("Native plugin must be registered", plugin.get());
            Method write = QibanNativePlugin.class.getDeclaredMethod("write", String.class, org.json.JSONObject.class);
            Method read = QibanNativePlugin.class.getDeclaredMethod("read", String.class);
            write.setAccessible(true); read.setAccessible(true);
            String name = "ci-smoke-" + UUID.randomUUID();
            File fixture = new File(vault, name + ".sealed");
            assertFalse(fixture.exists());
            try {
                write.invoke(plugin.get(), name, new JSObject().put("revision", 1).put("text", "qiban-independent-ci-fixture"));
                assertTrue(fixture.isFile());
                assertFalse("Fixture must be encrypted", new String(Files.readAllBytes(fixture.toPath()), StandardCharsets.UTF_8).contains("qiban-independent-ci-fixture"));
                assertEquals("qiban-independent-ci-fixture", ((JSObject)read.invoke(plugin.get(), name)).getString("text"));
            } finally { write.invoke(plugin.get(), name, null); }
            assertFalse(fixture.exists()); assertNull(read.invoke(plugin.get(), name));
            report.put("secureStoreWriteReadDelete", true);

            JSONObject ui = null;
            long until = System.currentTimeMillis() + 60000;
            while (System.currentTimeMillis() < until) {
                CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
                scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                    "JSON.stringify((()=>{const f=document.getElementById('auth'),u=document.getElementById('username'),p=document.getElementById('password');const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0};return {loginPath:location.pathname.endsWith('/login.html'),nativeBridge:!!(globalThis.QibanNative&&globalThis.QibanPlatform&&globalThis.QibanPlatform.native),formVisible:visible(f)&&visible(u)&&visible(p),usernameEmpty:!!(u&&u.value===''),passwordEmpty:!!(p&&p.value===''),passwordProtected:!!(p&&p.type==='password')}})())",
                    value -> { result.set(value); done.countDown(); }));
                if (done.await(5, TimeUnit.SECONDS) && result.get() != null) {
                    Object decoded = new JSONTokener(result.get()).nextValue();
                    if (decoded instanceof String) {
                        ui = new JSONObject((String)decoded);
                        if (ui.optBoolean("loginPath") && ui.optBoolean("nativeBridge") && ui.optBoolean("formVisible") && ui.optBoolean("usernameEmpty") && ui.optBoolean("passwordEmpty") && ui.optBoolean("passwordProtected")) break;
                    }
                }
                Thread.sleep(300);
            }
            assertNotNull("Bundled login DOM did not load", ui);
            for (String check : new String[]{"loginPath", "nativeBridge", "formVisible", "usernameEmpty", "passwordEmpty", "passwordProtected"}) assertTrue("Bundled login check failed: " + check, ui.optBoolean(check));
            report.put("login", ui);
            assertNotNull("Emulator external storage unavailable", context.getExternalFilesDir(null));
            File output = new File(context.getExternalFilesDir(null), "ci-smoke");
            assertTrue(output.isDirectory() || output.mkdirs());
            Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull("Login screenshot unavailable", screenshot);
            try (FileOutputStream file = new FileOutputStream(new File(output, "login.png"))) { assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, file)); }
            screenshot.recycle();
            Files.write(new File(output, "device-report.json").toPath(), report.toString(2).getBytes(StandardCharsets.UTF_8));
        }
    }
}
