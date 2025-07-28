chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "inject") {
    const iframes = document.querySelectorAll("iframe");

    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;

        if (doc) {
          injectInputValues(doc, message);
          console.log(doc,message)
          // MutationObserver로 동적 iframe 대응
          const observer = new MutationObserver(() => {
            injectInputValues(doc, message);
            console.log(doc,message)
          });
          observer.observe(doc, { childList: true, subtree: true });
        }
      } catch (e) {
        console.error("iframe 접근 실패:", e);
      }
    }
  } else if (message.action === "reset") {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
          injectInputValues(doc, { instCode: "", applCode: "", kindCode: "", txCode: "" });
        }
      } catch (e) {
        console.error("iframe 접근 실패:", e);
      }
    }
  }
});

// 입력값 설정 함수
function injectInputValues(doc, message) {
  const mappings = [
    { id: "INST_CD", value: message.instCode },
    { id: "APPL_CD", value: message.applCode },
    { id: "KIND_CD", value: message.kindCode },
    { id: "TX_CD", value: message.txCode },
  ];

  mappings.forEach((item) => {
    let inputElement = doc.getElementById(item.id);

    if (!inputElement) {
      // ID가 없으면 querySelector로 input 태그 검색
      inputElement = doc.querySelector(`input[name='${item.id}'], input`);
    }

    if (inputElement) {
      inputElement.value = item.value;
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      console.log(`${item.id} 입력 성공:`, item.value);
    } else {
      console.warn(`${item.id} input 요소를 찾을 수 없습니다.`);
    }
  });
}
