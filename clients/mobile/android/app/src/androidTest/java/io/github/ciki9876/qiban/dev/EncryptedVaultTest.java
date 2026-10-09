package io.github.ciki9876.qiban.dev;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Device test only: no cloud account, real credential, or network login is used. */
@RunWith(AndroidJUnit4.class)
public class EncryptedVaultTest {
    @Test public void encryptedDraftSurvivesReadRejectsTamperingAndSeparatesAccounts() throws Exception {
        assertEquals("Only use a newly created isolated AVD", "true", InstrumentationRegistry.getArguments().getString("qibanIsolatedAvd"));
        File existing = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(), "qiban-encrypted");
        // Fail before launching the app or entering cleanup; never decrypt or clear existing account data.
        for (String name : new String[]{"session", "draft-abcdefabcdefabcdefabcdefabcdefab", "draft-11111111111111111111111111111111"}) {
            assertFalse("Refusing to use existing account or fixture data", new File(existing, name + ".sealed").exists());
        }
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            final QibanNativePlugin[] holder = new QibanNativePlugin[1];
            final Context[] contexts = new Context[1];
            scenario.onActivity(activity -> {
                holder[0] = (QibanNativePlugin)activity.getBridge().getPlugin("QibanNative").getInstance();
                contexts[0] = activity.getApplicationContext();
            });
            QibanNativePlugin plugin = holder[0]; assertNotNull(plugin);
            Method write = QibanNativePlugin.class.getDeclaredMethod("write", String.class, JSONObject.class);
            Method read = QibanNativePlugin.class.getDeclaredMethod("read", String.class);
            Method allow = QibanNativePlugin.class.getDeclaredMethod("allowAccount", String.class);
            Method secret = QibanNativePlugin.class.getDeclaredMethod("containsSecret", Object.class);
            write.setAccessible(true); read.setAccessible(true); allow.setAccessible(true); secret.setAccessible(true);
            String id = "abcdefabcdefabcdefabcdefabcdefab";
            File file = new File(contexts[0].getNoBackupFilesDir(), "qiban-encrypted/draft-" + id + ".sealed");
            String other = "11111111111111111111111111111111";
            File otherFile = new File(contexts[0].getNoBackupFilesDir(), "qiban-encrypted/draft-" + other + ".sealed");
            try {
                write.invoke(plugin, "session", new JSObject().put("accountId", id).put("username", "vault-test-only").put("expires", System.currentTimeMillis() + 100000).put("token", "synthetic-native-token-only"));
                JSObject record = new JSObject().put("revision", 4).put("dirty", true).put("workspace", new JSObject().put("text", "device-test-private-draft"));
                write.invoke(plugin, "draft-" + id, record);
                byte[] first = Files.readAllBytes(file.toPath());
                assertFalse(new String(first, StandardCharsets.UTF_8).contains("device-test-private-draft"));
                assertEquals(4, ((JSObject)read.invoke(plugin, "draft-" + id)).getInteger("revision").intValue());
                write.invoke(plugin, "draft-" + id, record);
                byte[] second = Files.readAllBytes(file.toPath());
                assertFalse("AES-GCM must use a fresh nonce for every write", Arrays.equals(first, second));
                write.invoke(plugin, "draft-" + other, record);
                Files.write(otherFile.toPath(), first);
                try { read.invoke(plugin, "draft-" + other); fail("encrypted records could be swapped between accounts"); }
                catch (InvocationTargetException expected) { assertNotNull(expected.getCause()); }
                allow.invoke(plugin, id);
                try { allow.invoke(plugin, "11111111111111111111111111111111"); fail("cross-account access accepted"); }
                catch (InvocationTargetException expected) { assertNotNull(expected.getCause()); }
                assertEquals(true, secret.invoke(plugin, new JSObject().put("form", new JSObject().put("apiKey", "test-only"))));
                second[second.length - 1] ^= 1; Files.write(file.toPath(), second);
                try { read.invoke(plugin, "draft-" + id); fail("tampered data accepted"); }
                catch (InvocationTargetException expected) { assertNotNull(expected.getCause()); }
            } finally {
                write.invoke(plugin, "draft-" + id, null); write.invoke(plugin, "draft-" + other, null); write.invoke(plugin, "session", null);
            }
        }
    }
}
