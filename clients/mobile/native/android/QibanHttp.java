package io.github.ciki9876.qiban.dev;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

/** Native-only HTTP. It never consults Android/Capacitor's process-wide CookieHandler. */
final class QibanHttp {
    private static final String ORIGIN = "https://81.70.181.205";
    private static final int MAX_REQUEST = 12 * 1024 * 1024;
    private static final int MAX_RESPONSE = 16 * 1024 * 1024;
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final Set<String> GETS = new HashSet<>(Arrays.asList(
        "/api/native/health", "/api/native/account", "/api/native/workspace", "/api/native/ai/config"));
    private static final Set<String> POSTS = new HashSet<>(Arrays.asList(
        "/api/native/auth/login", "/api/native/auth/register", "/api/native/auth/logout",
        "/api/native/workspace", "/api/native/ai/config", "/api/native/ai/test",
        "/api/native/ai/plan", "/api/native/ai/feedback", "/api/native/ai/assist", "/api/native/ai/stage",
        "/api/native/ai/replace", "/api/native/ai/artifacts/upload", "/api/native/ai/artifacts/read"));
    private final OkHttpClient client = isolatedClient(HttpUrl.get(ORIGIN));

    // Package-private so a standalone JVM fixture can use its own loopback server.
    // Production always constructs this policy with the fixed HTTPS origin above.
    static OkHttpClient isolatedClient(HttpUrl origin) {
        if (!origin.username().isEmpty() || !origin.password().isEmpty() ||
            !origin.encodedPath().equals("/") || origin.query() != null || origin.fragment() != null)
            throw new IllegalArgumentException("Invalid native origin");
        return new OkHttpClient.Builder()
            .cookieJar(CookieJar.NO_COOKIES)
            .cache(null)
            .followRedirects(false)
            .followSslRedirects(false)
            .retryOnConnectionFailure(false)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            // HttpURLConnection had no separate write or total-call timeout.
            .writeTimeout(0, TimeUnit.SECONDS)
            .addNetworkInterceptor(chain -> {
                Request request = chain.request(); HttpUrl url = request.url();
                if (!url.scheme().equals(origin.scheme()) || !url.host().equals(origin.host()) || url.port() != origin.port() ||
                    !url.username().isEmpty() || !url.password().isEmpty() || url.query() != null || url.fragment() != null ||
                    !allowed(request.method(), url.encodedPath()) || request.header("Cookie") != null ||
                    request.header("Cookie2") != null || request.header("Origin") != null)
                    throw new IOException("Invalid native request channel");
                Response response = chain.proceed(request);
                // OkHttp otherwise follows 503 + Retry-After: 0 even when connection retries are disabled.
                // The bridge returns only status and JSON, so keep both and suppress this internal follow-up.
                return response.code() == 503 ? response.newBuilder().removeHeader("Retry-After").build() : response;
            }).build();
    }

    private static boolean allowed(String method, String path) {
        return "GET".equals(method) && GETS.contains(path) || "POST".equals(method) && POSTS.contains(path);
    }

    static final class Result {
        final int status; final String body;
        Result(int status, String body) { this.status = status; this.body = body; }
    }

    Result fetch(String path, String method, byte[] body, String token) throws IOException {
        if (!allowed(method, path)) throw new IOException("Invalid native request path");
        Request.Builder request = new Request.Builder().url(ORIGIN + path).header("Accept", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        if ("POST".equals(method)) {
            byte[] bytes = body == null ? "{}".getBytes(StandardCharsets.UTF_8) : body;
            if (bytes.length > MAX_REQUEST) throw new IOException("Native request is too large");
            request.post(RequestBody.create(bytes, JSON));
        } else if (body != null) throw new IOException("GET cannot contain a body");
        try (Response response = client.newCall(request.build()).execute()) {
            ResponseBody responseBody = response.body();
            if (responseBody == null || responseBody.contentLength() > MAX_RESPONSE) throw new IOException("Invalid native response");
            try (InputStream stream = responseBody.byteStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (bytes.size() + count > MAX_RESPONSE) throw new IOException("Native response is too large");
                    bytes.write(buffer, 0, count);
                }
                return new Result(response.code(), new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            }
        }
    }
}
