package io.github.ciki9876.qiban.dev;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "QibanNative")
public class QibanNativePlugin extends Plugin {
    private static final String KEY_ALIAS = "io.github.ciki9876.qiban.dev.vault.v1";
    private static final int MAX_FILE = 16 * 1024 * 1024;
    private static final Set<String> GETS = new HashSet<>(Arrays.asList("/api/health", "/api/account", "/api/workspace", "/api/ai/config"));
    private static final Set<String> POSTS = new HashSet<>(Arrays.asList("/api/workspace", "/api/ai/config", "/api/ai/test", "/api/ai/plan", "/api/ai/feedback", "/api/ai/assist", "/api/ai/stage", "/api/ai/replace", "/api/ai/artifacts/upload", "/api/ai/artifacts/read"));
    private static final Set<String> BLOCKED = new HashSet<>(Arrays.asList("password", "passwordhash", "apikey", "token", "authorization", "csrf", "salt"));
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService networkWorker = Executors.newFixedThreadPool(3);
    private final QibanHttp http = new QibanHttp();
    private byte[] exportData;

    private interface Job { JSObject run() throws Exception; }
    private static class AccountChanged extends Exception {}
    private JSObject accountChanged() { return new JSObject().put("status", 409).put("data", new JSObject().put("code", "ACCOUNT_CHANGED").put("message", "账号已变化，请重新打开栖伴。")); }
    private void run(PluginCall call, Job job) {
        worker.execute(() -> {
            try { call.resolve(job.run()); }
            catch (Exception e) { call.reject("本机安全存储或网络暂时无法完成操作，请检查网络后重试。", "NATIVE_ERROR"); }
        });
    }
    private void network(PluginCall call, Job job) {
        networkWorker.execute(() -> {
            try { call.resolve(job.run()); }
            catch (AccountChanged e) { call.reject("账号已变化，请重新打开栖伴。", "ACCOUNT_CHANGED"); }
            catch (Exception e) { call.reject("无法连接栖伴，请检查网络后重试。", "NETWORK"); }
        });
    }
    private File vault(String name) throws Exception {
        File dir = new File(getContext().getNoBackupFilesDir(), "qiban-encrypted");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("storage");
        return new File(dir, name + ".sealed");
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).setRandomizedEncryptionRequired(true).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY_ALIAS, null);
    }
    private byte[] readBytes(InputStream input, int limit) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int n;
        while ((n = input.read(buffer)) != -1) {
            if (output.size() + n > limit) throw new Exception("too large");
            output.write(buffer, 0, n);
        }
        return output.toByteArray();
    }
    private JSObject read(String name) throws Exception {
        File file = vault(name); if (!file.exists()) return null;
        byte[] bytes;
        try (InputStream stream = new AtomicFile(file).openRead()) { bytes = readBytes(stream, MAX_FILE); }
        if (bytes.length < 29 || bytes[0] != 1) throw new Exception("storage version");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Arrays.copyOfRange(bytes, 1, 13)));
        cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
        return new JSObject(new String(cipher.doFinal(Arrays.copyOfRange(bytes, 13, bytes.length)), StandardCharsets.UTF_8));
    }
    private void write(String name, JSONObject object) throws Exception {
        AtomicFile file = new AtomicFile(vault(name));
        if (object == null) { file.delete(); return; }
        byte[] plain = object.toString().getBytes(StandardCharsets.UTF_8);
        if (plain.length > 12 * 1024 * 1024) throw new Exception("too large");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
        byte[] ciphertext = cipher.doFinal(plain); byte[] iv = cipher.getIV();
        if (iv.length != 12) throw new Exception("invalid iv");
        FileOutputStream stream = null;
        try {
            stream = file.startWrite(); stream.write(1); stream.write(iv); stream.write(ciphertext); file.finishWrite(stream);
        } catch (Exception e) { if (stream != null) file.failWrite(stream); throw e; }
    }
    private JSObject session() throws Exception { return read("session"); }
    private void allowAccount(String id) throws Exception {
        JSObject session = session();
        if (id == null || !id.matches("[a-f0-9]{32}") || session == null || !id.equals(session.getString("accountId"))) throw new Exception("wrong account");
    }
    private boolean containsSecret(Object value) throws Exception {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject)value; Iterator<String> keys = object.keys();
            while (keys.hasNext()) { String key = keys.next(); if (BLOCKED.contains(key.toLowerCase(java.util.Locale.ROOT)) || containsSecret(object.get(key))) return true; }
        } else if (value instanceof JSONArray) {
            JSONArray array = (JSONArray)value; for (int i = 0; i < array.length(); i++) if (containsSecret(array.get(i))) return true;
        }
        return false;
    }
    private JSObject metadata(JSObject session) {
        return new JSObject().put("accountId", session.getString("accountId")).put("username", session.getString("username")).put("expires", session.optDouble("expires"));
    }
    private JSObject fetch(String path, String method, JSONObject body, String token) throws Exception {
        byte[] bytes = body == null ? null : body.toString().getBytes(StandardCharsets.UTF_8);
        QibanHttp.Result result = http.fetch(path, method, bytes, token);
        return new JSObject().put("status", result.status).put("data", new JSObject(result.body));
    }
    @PluginMethod public void auth(PluginCall call) {
        String kind = call.getString("kind"), username = call.getString("username"), password = call.getString("password");
        if (!("login".equals(kind) || "register".equals(kind)) || username == null || password == null) { call.reject("登录内容不完整。"); return; }
        networkWorker.execute(() -> {
            try {
                JSObject response = fetch("/api/native/auth/" + kind, "POST", new JSObject().put("username", username).put("password", password), null);
                JSObject data = response.getJSObject("data"); int status = response.getInteger("status", 500);
                if (status != 200) { call.reject(data.getString("message", "无法登录，请稍后重试。"), "HTTP_" + status); return; }
                String token = data.getString("token"), id = data.getString("accountId");
                if (token == null || !token.matches("[a-f0-9]{64}") || id == null || !id.matches("[a-f0-9]{32}") || data.getString("username") == null || !Double.isFinite(data.optDouble("expires"))) throw new Exception("invalid session");
                JSObject saved = metadata(data).put("token", token);
                worker.submit(() -> { write("session", saved); return true; }).get();
                call.resolve(metadata(saved));
            } catch (Exception e) { call.reject("无法连接或保存登录，请检查网络后重试。", "NETWORK"); }
        });
    }
    @PluginMethod public void request(PluginCall call) {
        String path = call.getString("path"), method = call.getString("method"), expected = call.getString("expectedAccountId");
        if (!("GET".equals(method) && GETS.contains(path) || "POST".equals(method) && POSTS.contains(path))) { call.reject("不支持的栖伴接口。", "INVALID_PATH"); return; }
        boolean metadata = "/api/account".equals(path) || "/api/health".equals(path);
        network(call, () -> {
            JSObject session = worker.submit(this::session).get();
            if (session == null || session.optDouble("expires") <= System.currentTimeMillis()) return new JSObject().put("status", 401).put("data", new JSObject().put("message", "请重新登录栖伴。"));
            if ((!metadata || expected != null) && (expected == null || !expected.matches("[a-f0-9]{32}") || !expected.equals(session.getString("accountId")))) return accountChanged();
            JSObject response = fetch("/api/native/" + path.substring(5), method, call.getObject("body"), session.getString("token"));
            boolean unchanged = worker.submit(() -> { JSObject current = session(); return current != null && session.getString("token").equals(current.getString("token")); }).get();
            return unchanged ? response : accountChanged();
        });
    }
    @PluginMethod public void logout(PluginCall call) {
        String expected = call.getString("expectedAccountId");
        network(call, () -> {
            JSObject session = worker.submit(this::session).get();
            if (session == null) throw new AccountChanged();
            if (expected == null || !expected.matches("[a-f0-9]{32}") || !expected.equals(session.getString("accountId"))) throw new AccountChanged();
            int status = fetch("/api/native/auth/logout", "POST", null, session.getString("token")).getInteger("status", 500);
            if (status != 200 && status != 401) throw new Exception("logout not revoked");
            boolean cleared = worker.submit(() -> {
                // A changed account must not be cleared by the result of an older logout request.
                JSObject current = session();
                if (current == null || !session.getString("token").equals(current.getString("token"))) return false;
                write("draft-" + session.getString("accountId"), null);
                write("last-account", null); write("session", null); return true;
            }).get();
            if (!cleared) throw new AccountChanged();
            return new JSObject().put("ok", true);
        });
    }
    @PluginMethod public void cacheRead(PluginCall call) {
        String id = call.getString("accountId");
        run(call, () -> { allowAccount(id); JSObject record = read("draft-" + id); return new JSObject().put("record", record == null ? JSONObject.NULL : record); });
    }
    @PluginMethod public void cacheWrite(PluginCall call) {
        String id = call.getString("accountId"); JSObject record = call.getObject("record");
        run(call, () -> {
            allowAccount(id); if (record == null || containsSecret(record)) throw new Exception("private fields");
            write("draft-" + id, record); return new JSObject().put("ok", true);
        });
    }
    @PluginMethod public void cacheDelete(PluginCall call) {
        String id = call.getString("accountId");
        run(call, () -> {
            if (id == null || !id.matches("[a-f0-9]{32}")) throw new Exception("invalid account");
            if (vault("draft-" + id).exists()) { allowAccount(id); write("draft-" + id, null); }
            return new JSObject().put("ok", true);
        });
    }
    @PluginMethod public void cacheLast(PluginCall call) { run(call, () -> { JSObject record = read("last-account"); return new JSObject().put("record", record == null ? JSONObject.NULL : record); }); }
    @PluginMethod public void cacheRemember(PluginCall call) { run(call, () -> { allowAccount(call.getString("accountId")); write("last-account", metadata(session())); return new JSObject().put("ok", true); }); }
    @PluginMethod public void cacheForget(PluginCall call) { run(call, () -> { write("last-account", null); return new JSObject().put("ok", true); }); }
    @PluginMethod public void openExternal(PluginCall call) {
        try {
            String raw = call.getString("url"); URI url = new URI(raw == null ? "" : raw);
            if (!("https".equalsIgnoreCase(url.getScheme()) || "http".equalsIgnoreCase(url.getScheme())) || url.getHost() == null || url.getUserInfo() != null) throw new Exception("invalid url");
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(raw))); call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) { call.reject("无法打开外部链接。"); }
    }
    @PluginMethod public void saveFile(PluginCall call) {
        if (exportData != null) { call.reject("请先完成当前文件操作。"); return; }
        try {
            String name = call.getString("name"), base64 = call.getString("base64"), mime = call.getString("mime", "application/octet-stream");
            if (name == null || name.isEmpty() || name.length() > 180 || name.contains("/") || name.contains("\\") || base64 == null || base64.length() > MAX_FILE * 4 / 3 + 16) throw new Exception("invalid file");
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT); if (bytes.length > MAX_FILE) throw new Exception("too large");
            if (Boolean.TRUE.equals(call.getBoolean("share", false))) {
                File dir = new File(getContext().getCacheDir(), "qiban-exports"); if (!dir.exists() && !dir.mkdirs()) throw new Exception("storage");
                File[] old = dir.listFiles();
                if (old != null) for (File folder : old) if (folder.isDirectory() && folder.getName().matches("[a-f0-9-]{36}") && folder.lastModified() < System.currentTimeMillis() - 86400000) {
                    File[] files = folder.listFiles(); if (files != null) for (File file : files) if (file.isFile()) file.delete();
                    folder.delete();
                }
                File subdir = new File(dir, java.util.UUID.randomUUID().toString()); if (!subdir.mkdirs()) throw new Exception("storage");
                File file = new File(subdir, name); try (OutputStream output = new FileOutputStream(file)) { output.write(bytes); }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                Intent intent = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(Intent.createChooser(intent, "分享栖伴文件")); call.resolve(new JSObject().put("ok", true));
            } else {
                exportData = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(call, intent, "saveResult");
            }
        } catch (Exception e) { exportData = null; call.reject("无法准备导出文件。"); }
    }
    @ActivityCallback private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) { exportData = null; return; }
        try {
            Uri uri = result.getData() == null ? null : result.getData().getData();
            if (result.getResultCode() != Activity.RESULT_OK || uri == null) { call.resolve(new JSObject().put("ok", false)); return; }
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null || exportData == null) throw new Exception("storage"); output.write(exportData);
            }
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) { call.reject("文件未保存，请重试。"); }
        finally { exportData = null; }
    }
    public void emitBack() { notifyListeners("back", new JSObject()); }
    @Override public Boolean shouldOverrideLoad(Uri url) {
        if ("https".equals(url.getScheme()) && "localhost".equals(url.getHost()) && url.getPort() == -1 && url.getUserInfo() == null) return null;
        if (("https".equalsIgnoreCase(url.getScheme()) || "http".equalsIgnoreCase(url.getScheme())) && url.getHost() != null && url.getUserInfo() == null) {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (Exception ignored) {}
        }
        return true;
    }
    @Override protected void handleOnResume() { notifyListeners("lifecycle", new JSObject().put("active", true)); }
    @Override protected void handleOnPause() { notifyListeners("lifecycle", new JSObject().put("active", false)); }
    @Override protected void handleOnDestroy() { networkWorker.shutdownNow(); worker.shutdown(); }
}
