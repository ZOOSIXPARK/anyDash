import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class SimpleCsvServer {

    public static void main(String[] args) throws IOException {
        int port = 3000;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        System.out.println("Server running at http://localhost:" + port);

        server.createContext("/", new CsvHandler());
        server.setExecutor(null); // default executor
        server.start();
    }

    static class CsvHandler implements HttpHandler {
        private final File baseDir = new File("/app/logs/biz/");
        // ✅ 1. 스레드 안전한 캐시 저장소 생성
        // 파일 내용을 저장하는 캐시
        private final Map<String, byte[]> contentCache = new ConcurrentHashMap<>();
        // 파일의 최종 수정 시간을 저장하는 캐시
        private final Map<String, Long> timestampCache = new ConcurrentHashMap<>();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                return;
            }

            URI requestUri = exchange.getRequestURI();
            String path = requestUri.getPath();
            String fileName;

            if ("/downTx".equals(path)) {
                fileName = "b.csv";
            } else {
                if (path.contains("..")) {
                    exchange.sendResponseHeaders(400, -1); // Bad Request
                    return;
                }
                fileName = new File(path).getName();
            }

            if (fileName.isEmpty()) {
                exchange.sendResponseHeaders(404, -1); // Not Found
                return;
            }

            File csvFile = new File(baseDir, fileName);

            if (!csvFile.getCanonicalPath().startsWith(baseDir.getCanonicalPath())) {
                exchange.sendResponseHeaders(403, -1); // Forbidden
                return;
            }

            if (!csvFile.exists() || !csvFile.isFile()) {
                exchange.sendResponseHeaders(404, -1); // Not Found
                return;
            }

            // ✅ 2. 캐싱 및 갱신 로직
            byte[] response;
            long lastModified = csvFile.lastModified();
            Long cachedTimestamp = timestampCache.get(fileName);

            // 캐시에 저장된 시간이 현재 파일의 수정 시간과 동일하면 캐시된 데이터를 사용
            if (cachedTimestamp != null && lastModified == cachedTimestamp) {
                response = contentCache.get(fileName);
                System.out.println("Cache hit for: " + fileName); // 캐시 사용 로그
            } else {
                // 파일이 변경되었거나 처음 로드하는 경우, 파일을 읽고 캐시를 업데이트
                System.out.println("Cache miss for: " + fileName); // 캐시 미사용 로그
                response = readFileToBytes(csvFile);
                contentCache.put(fileName, response);
                timestampCache.put(fileName, lastModified);
            }

            Headers headers = exchange.getResponseHeaders();
            headers.add("Content-Type", "text/csv; charset=utf-8");
            headers.add("Access-Control-Allow-Origin", "*");

            exchange.sendResponseHeaders(200, response.length);
            OutputStream os = exchange.getResponseBody();
            os.write(response);
            os.close();
        }

        private byte[] readFileToBytes(File file) throws IOException {
            try (InputStream is = new FileInputStream(file);
                 ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {

                byte[] data = new byte[4096];
                int nRead;
                while ((nRead = is.read(data, 0, data.length)) != -1) {
                    buffer.write(data, 0, nRead);
                }
                return buffer.toByteArray();
            }
        }
    }
}
