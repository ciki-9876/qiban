package io.github.ciki9876.qiban.dev;

import static org.junit.Assert.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.junit.Test;

/** Standalone JVM fixture: no Android device, WebView cookie values, account or TLS changes. */
public class QibanHttpTest {
    @Test public void nativeRequestsIgnoreGlobalCookiesAndSetCookieAndDoNotFollowRedirects() throws Exception {
        CookieHandler previous = CookieHandler.getDefault();
        AtomicInteger cookieReads = new AtomicInteger(), cookieWrites = new AtomicInteger();
        CookieHandler synthetic = new CookieHandler() {
            @Override public Map<String, List<String>> get(URI uri, Map<String, List<String>> headers) {
                cookieReads.incrementAndGet();
                return Map.of("Cookie", List.of("fixture-only=not-a-real-session"));
            }
            @Override public void put(URI uri, Map<String, List<String>> headers) { cookieWrites.incrementAndGet(); }
        };
        ExecutorService worker = Executors.newSingleThreadExecutor();
        OkHttpClient client = null;
        try (ServerSocket server = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))) {
            server.setSoTimeout(5000);
            List<List<String>> received = new ArrayList<>();
            Future<?> served = worker.submit(() -> {
                try {
                    for (int index = 0; index < 3; index++) {
                        try (Socket socket = server.accept()) {
                            socket.setSoTimeout(5000);
                            BufferedReader input = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
                            List<String> headers = new ArrayList<>(); String line;
                            while ((line = input.readLine()) != null && !line.isEmpty()) headers.add(line);
                            received.add(headers);
                            byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
                            String response = "HTTP/1.1 " + (index == 0 ? "302 Found" : index == 1 ? "503 Service Unavailable" : "200 OK") + "\r\n" +
                                (index == 0 ? "Location: /api/native/account\r\n" : "") +
                                (index == 1 ? "Retry-After: 0\r\n" : "") +
                                "Set-Cookie: fixture-response-only=synthetic; Path=/\r\n" +
                                "Content-Type: application/json\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n";
                            OutputStream output = socket.getOutputStream(); output.write(response.getBytes(StandardCharsets.US_ASCII)); output.write(body); output.flush();
                        }
                    }
                } catch (Exception error) { throw new RuntimeException("Synthetic server failed", error); }
            });
            CookieHandler.setDefault(synthetic);
            HttpUrl origin = HttpUrl.get("http://127.0.0.1:" + server.getLocalPort());
            client = QibanHttp.isolatedClient(origin);
            assertSame(CookieJar.NO_COOKIES, client.cookieJar()); assertNull(client.cache());
            assertFalse(client.followRedirects()); assertFalse(client.followSslRedirects()); assertFalse(client.retryOnConnectionFailure());
            assertEquals(15000, client.connectTimeoutMillis()); assertEquals(90000, client.readTimeoutMillis());
            for (int index = 0; index < 3; index++) {
                Request request = new Request.Builder().url(origin.resolve(index == 0 ? "/api/native/health" : index == 1 ? "/api/native/account" : "/api/native/workspace"))
                    .header("Accept", "application/json").header("Authorization", "Bearer synthetic-fixture-only").build();
                try (Response response = client.newCall(request).execute()) {
                    assertEquals(index == 0 ? 302 : index == 1 ? 503 : 200, response.code()); assertEquals("{}", response.body().string());
                }
            }
            served.get(5, TimeUnit.SECONDS);
            assertEquals("Redirect or Retry-After must not issue another request", 3, received.size());
            assertEquals("GET /api/native/health HTTP/1.1", received.get(0).get(0));
            assertEquals("GET /api/native/account HTTP/1.1", received.get(1).get(0));
            assertEquals("GET /api/native/workspace HTTP/1.1", received.get(2).get(0));
            for (List<String> headers : received) for (String header : headers)
                assertFalse("Native channel sent a browser header", header.matches("(?i)^(Cookie2?|Origin):.*"));
            for (String header : new String[]{"Cookie", "Cookie2", "Origin"}) {
                Request contaminated = new Request.Builder().url(origin.resolve("/api/native/health")).header(header, "synthetic-only").build();
                try {client.newCall(contaminated).execute().close(); fail("Browser header must be rejected");}
                catch (java.io.IOException expected) { assertEquals("Invalid native request channel", expected.getMessage()); }
            }
            Request credentials = new Request.Builder().url(origin.newBuilder().username("fixture").password("fixture-only").encodedPath("/api/native/health").build()).build();
            try {client.newCall(credentials).execute().close(); fail("URL credentials must be rejected");}
            catch (java.io.IOException expected) { assertEquals("Invalid native request channel", expected.getMessage()); }
            assertEquals("Process-global cookie reads must never happen", 0, cookieReads.get());
            assertEquals("Remote Set-Cookie must not enter the global store", 0, cookieWrites.get());
            assertSame("The production policy must not replace the global handler", synthetic, CookieHandler.getDefault());
        } finally {
            CookieHandler.setDefault(previous);
            if (client != null) {client.dispatcher().cancelAll(); client.connectionPool().evictAll(); client.dispatcher().executorService().shutdown();}
            worker.shutdownNow(); worker.awaitTermination(5, TimeUnit.SECONDS);
        }
    }
}
