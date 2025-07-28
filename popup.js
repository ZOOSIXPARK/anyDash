let data = [];

// 메시지를 content script로 보내는 헬퍼 함수
async function sendMessageToContentScript(tabId, message, retries = 3) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'],
    });
  } catch (e) {
    if (!e.message.includes("Cannot access a chrome-extension:// URL")) {
      console.warn("Failed to inject content script:", e);
    }
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      if (error.message.includes("Receiving end does not exist") && i < retries - 1) {
        console.warn(`Retrying message to content script (${retries - 1 - i} attempts left):`, error.message);
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms before retrying
      } else {
        console.error("Error sending message:", error.message);
        throw error; // Re-throw other errors or the last retry error
      }
    }
  }
  return null; // Should not reach here if retries are exhausted and error is thrown
}

// 데이터 소스별 로드 함수
function loadAPI() {
  fetch("http://localhost:3000/downTx")
    .then((response) => response.text())
    .then((csv) => {
      // 데이터 파싱
      let parsedData = parseCSV(csv);

      // inst_nm(기관명)을 기준으로 가나다순 정렬
      parsedData.sort((a, b) => {
        const nameA = a.inst_nm || '';
        const nameB = b.inst_nm || '';
        return nameA.localeCompare(nameB, 'ko-KR');
      });

      data = parsedData; // 정렬된 데이터를 전역 변수에 저장
      renderTable(data); // 정렬된 데이터로 테이블 렌더링
      console.log("API 데이터 로드 및 정렬 완료:", data);
    })
    .catch((error) => console.error("API 데이터 불러오기 실패:", error));
}

// 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  // 최초 로드: API
  loadAPI();

  // 초기화 버튼 설정
  document.getElementById("resetBtn").addEventListener("click", async () => {
    // 팝업 내 검색 입력란 초기화
    document.getElementById("searchInput").value = '';
    // 전체 데이터 다시 렌더링
    renderTable(data);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await sendMessageToContentScript(tab.id, { action: "reset" });
    }
    window.close();
  });

  // 검색 기능 설정
  document.getElementById("searchInput").addEventListener("input", (event) => {
    const searchTerms = event.target.value.toLowerCase().split(' ').filter(term => term.trim() !== '');
    if (searchTerms.length === 0) {
      renderTable(data); // 검색어가 없으면 전체 데이터 표시
      return;
    }

    const filteredData = data.filter((item) => {
      const itemText = Object.values(item).join(' ').toLowerCase();
      return searchTerms.every(term => itemText.includes(term));
    });
    renderTable(filteredData);
  });
});

// CSV 파싱 함수
function parseCSV(csv) {
    const rows = csv.trim().split('\n');
    const headers = rows.shift().split(',').map(h => h.trim());

    return rows.map(rowStr => {
        if (!rowStr) return null;

        const values = [];
        const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
        let match;
        while (match = regex.exec(rowStr)) {
            let value = match[1];
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/""/g, '"');
            }
            values.push(value.trim());
        }

        if (values.length === 0 && rowStr.length > 0) {
            console.warn("Complex CSV row parsing failed, falling back to simple split for row:", rowStr);
            values.push(...rowStr.split(',').map(v => v.trim()));
        }

        return headers.reduce((acc, header, idx) => {
            acc[header] = values[idx] || '';
            return acc;
        }, {});
    }).filter(Boolean);
}

// 테이블 렌더링 함수
function renderTable(filteredData) {
  const tableBody = document.querySelector("#dataTable tbody");
  tableBody.innerHTML = ""; // 기존 테이블 내용 초기화

  // 데이터 행 추가
  filteredData.forEach((item) => {
    const row = `
      <tr>
        <td>
          <button class="reflectBtn" 
            data-instcode="${item.inst_code}" 
            data-applcode="${item.appl_code}"
            data-kindcode="${item.kind_code}" 
            data-txcode="${item.tx_code}">
            반영
          </button>
        </td>
        <td>${item.inst_nm}</td>
        <td>${item.inst_code}</td>
        <td>${item.appl_code}</td>
        <td>${item.kind_code}</td>
        <td>${item.tx_code}</td>
        <td>${item.upmu_nm}</td>
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
    button.addEventListener("click", async () => {
      const instCode = button.dataset.instcode;
      const applCode = button.dataset.applcode;
      const kindCode = button.dataset.kindcode;
      const txCode = button.dataset.txcode;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await sendMessageToContentScript(tab.id, {
          action: "inject",
          instCode,
          applCode,
          kindCode,
          txCode,
        });
      }
      window.close();
    })
  );
}
