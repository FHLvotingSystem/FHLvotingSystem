import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCInvUQaAjeXydIwrjHBtI6zGNCObbOFw8",
  authDomain: "fhlvotingsystem-2f57a.firebaseapp.com",
  projectId: "fhlvotingsystem-2f57a",
  storageBucket: "fhlvotingsystem-2f57a.firebasestorage.app",
  messagingSenderId: "360590968518",
  appId: "1:360590968518:web:149da0f1257d70676bb9c7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let validAccessCode = "";
let globalRolesConfig =[]; 

const closedSection = document.getElementById('closed-section');
const loginSection = document.getElementById('login-section');
const votingSection = document.getElementById('voting-section');
const successSection = document.getElementById('success-section');
const verifyBtn = document.getElementById('verify-btn');
const submitBtn = document.getElementById('submit-vote-btn');
const loginMessage = document.getElementById('login-message');

// ★ 新增：網頁載入時，先檢查系統有沒有被鎖住
async function checkSystemStatus() {
    try {
        const settingSnap = await getDoc(doc(db, "SystemSettings", "global"));
        // 如果設定存在，且 isVotingOpen 被設為 false，就鎖住系統
        if (settingSnap.exists() && settingSnap.data().isVotingOpen === false) {
            closedSection.style.display = "block";
            loginSection.style.display = "none";
        } else {
            // 系統開放
            closedSection.style.display = "none";
            loginSection.style.display = "block";
        }
    } catch (error) {
        console.error("無法取得系統狀態");
        loginSection.style.display = "block"; // 預設開放
    }
}
checkSystemStatus();

verifyBtn.addEventListener('click', async () => {
    const inputCode = document.getElementById('access-code-input').value.trim();
    if (!inputCode) return;
    verifyBtn.disabled = true;
    verifyBtn.textContent = "驗證中...";
    try {
        const codeRef = doc(db, "AccessCodes", inputCode);
        const codeSnap = await getDoc(codeRef);
        if (codeSnap.exists() && codeSnap.data().isUsed === false) {
            validAccessCode = inputCode;
            loginSection.style.display = "none";
            votingSection.style.display = "block";
            renderVotingForm();
        } else {
            loginMessage.textContent = codeSnap.exists() ? "這個密碼已經被使用過了！" : "無效的密碼，請檢查是否輸入錯誤。";
        }
    } catch (error) {
        loginMessage.textContent = "系統連線錯誤。";
    }
    verifyBtn.disabled = false;
    verifyBtn.textContent = "驗證密碼";
});

async function renderVotingForm() {
    const formContainer = document.getElementById('voting-form');
    formContainer.innerHTML = '<h2>載入選票中...</h2>';
    globalRolesConfig =[]; 

    try {
        const q = query(collection(db, "ElectionRoles"), orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        formContainer.innerHTML = ''; 

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            globalRolesConfig.push({ title: data.title, max: data.max_votes });

            const roleDiv = document.createElement('div');
            roleDiv.className = 'role-section';

            const titleElement = document.createElement('h3');
            titleElement.textContent = `${data.title} (應選 ${data.max_votes} 人)`;
            titleElement.style.marginTop = "0";
            roleDiv.appendChild(titleElement);

            for (let i = 0; i < data.max_votes; i++) {
                const label = document.createElement('span');
                label.className = 'select-label';
                label.textContent = `請選擇第 ${i + 1} 位：`;
                roleDiv.appendChild(label);

                const select = document.createElement('select');
                select.className = 'candidate-select'; 
                select.name = data.title; 
                select.innerHTML = `<option value="">-- 放棄 / 不圈選 --</option>`;

                data.candidates.forEach((personName) => {
                    select.innerHTML += `<option value="${personName}">${personName}</option>`;
                });

                select.addEventListener('change', (e) => {
                    if (!e.target.value) return; 
                    const allSelects = document.querySelectorAll('.candidate-select');
                    let count = 0;
                    allSelects.forEach(s => { if (s.value === e.target.value) count++; });
                    if (count > 1) {
                        alert(`「${e.target.value}」已經被選取了，同一個人不能重複選喔！`);
                        e.target.value = ""; 
                    }
                });
                roleDiv.appendChild(select);
            }
            formContainer.appendChild(roleDiv);
        });
    } catch (error) {
        formContainer.innerHTML = "<p style='color:red;'>無法載入選票。</p>";
    }
}

submitBtn.addEventListener('click', async () => {
    const voteData = {};
    const allSelects = document.querySelectorAll('.candidate-select');
    allSelects.forEach(select => {
        const role = select.name;
        const candidate = select.value;
        if (candidate) { 
            if (!voteData[role]) voteData[role] = []; 
            voteData[role].push(candidate); 
        }
    });

    let warningMsgs =[];
    globalRolesConfig.forEach(role => {
        const selectedCount = voteData[role.title] ? voteData[role.title].length : 0;
        if (selectedCount < role.max) {
            warningMsgs.push(`「${role.title}」應選 ${role.max} 人，您只選了 ${selectedCount} 人。`);
        }
    });

    if (warningMsgs.length > 0) {
        const confirmMsg = warningMsgs.join('\n') + "\n\n確定要放棄剩餘名額並直接送出選票嗎？";
        if (!confirm(confirmMsg)) return; 
    } else {
        if (!confirm("選票送出後即無法修改，確定送出？")) return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "資料傳送中...";

    try {
        await addDoc(collection(db, "Votes"), voteData);
        await updateDoc(doc(db, "AccessCodes", validAccessCode), { isUsed: true });
        votingSection.style.display = "none";
        successSection.style.display = "block";
    } catch (error) {
        alert("傳送失敗，請尋求工作人員協助。");
        submitBtn.disabled = false;
        submitBtn.textContent = "確認送出選票";
    }
});