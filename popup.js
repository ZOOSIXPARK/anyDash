let data = [];

// 페이지 로드 시 CSV 파일 불러오기 및 초기화
document.addEventListener("DOMContentLoaded", () => {
  // CSV 파일 로드
  fetch(chrome.runtime.getURL("a.csv"))
    .then((response) => response.text())
    .then((csv) => {
      data = parseCSV(csv); // CSV 데이터를 파싱하여 저장
      renderTable(data); // 테이블 렌더링
      console.log("CSV 데이터 로드 완료:", data);
    })
    .catch((error) => console.error("CSV 파일 불러오기 실패:", error));

  // 검색 기능 설정
  document.getElementById("searchInput").addEventListener("input", (event) => {
    const searchTerm = event.target.value.toLowerCase();
    const filteredData = data.filter((item) =>
      Object.values(item).some((value) => value.toLowerCase().includes(searchTerm))
    );
    renderTable(filteredData);
  });
});

// CSV 파싱 함수
function parseCSV(csv) {
  const rows = csv.trim().split("\n"); // 줄 단위로 분리
  const headers = rows.shift().split(","); // 첫 번째 줄은 헤더

  return rows.map((row) => {
    const values = row.split(",");
    return headers.reduce((acc, header, idx) => {
      acc[header.trim()] = values[idx].trim(); // 헤더와 값을 매핑
      return acc;
    }, {});
  });
}

// 테이블 렌더링 함수
function renderTable(filteredData) {
  const tableBody = document.querySelector("#dataTable tbody");
  tableBody.innerHTML = ""; // 기존 테이블 내용 초기화

  // 데이터 행 추가
  filteredData.forEach((item) => {
    const row = `
      <tr>
        <td>${item.inst_nm}</td>
        <td>${item.inst_code}</td>
        <td>${item.appl_code}</td>
        <td>${item.kind_code}</td>
        <td>${item.tx_code}</td>
        <td>${item.upmu_nm}</td>
        <td>
          <button class="reflectBtn" 
            data-instcode="${item.inst_code}" 
            data-applcode="${item.appl_code}"
            data-kindcode="${item.kind_code}" 
            data-txcode="${item.tx_code}">
            반영
          </button>
        </td>
      </tr>
    `;
    tableBody.insertAdjacentHTML("beforeend", row);
  });

  // 버튼 이벤트 핸들러 추가
  setupReflectButtons();
}

// 반영 버튼 이벤트 설정 함수
function setupReflectButtons() {
  document.querySelectorAll(".reflectBtn").forEach((button) =>
    button.addEventListener("click", () => {
      const instCode = button.dataset.instcode;
      const applCode = button.dataset.applcode;
      const kindCode = button.dataset.kindcode;
      const txCode = button.dataset.txcode;

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "inject",
          instCode,
          applCode,
          kindCode,
          txCode,
        });
      });
      window.close();
    })
  );
}
