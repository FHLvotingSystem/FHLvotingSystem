import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

let currentTallyResult = {};

// 產生隨機 5 碼大寫英數字
function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// 1. 產生 40 組密碼
document.getElementById('generate-codes-btn').addEventListener('click', async (e) => {
    if (!confirm("確定要產生新的 40 組密碼嗎？這會花費幾秒鐘。")) return;
    e.target.disabled = true;
    e.target.textContent = "產生中...";
    let generatedCodesText = "";

    try {
        for (let i = 0; i < 40; i++) {
            const newCode = generateRandomCode();
            await setDoc(doc(db, "AccessCodes", newCode), { isUsed: false });
            generatedCodesText += newCode + " &nbsp;&nbsp;&nbsp; ";
            if ((i + 1) % 5 === 0) generatedCodesText += "<br>";
        }
        const displayDiv = document.getElementById('codes-display');
        displayDiv.style.display = "block";
        displayDiv.innerHTML = generatedCodesText;
        alert("40 組密碼已產生並存入資料庫！");
    } catch (error) {
        alert("產生錯誤！");
    }
    e.target.disabled = false;
    e.target.textContent = "產生 40 組新密碼";
});

// 2. 讀取職位 (依照順序)
async function loadRoles() {
    const listDiv = document.getElementById('current-roles-list');
    listDiv.innerHTML = "讀取中...";
    try {
        const q = query(collection(db, "ElectionRoles"), orderBy("order", "asc"));
        const snap = await getDocs(q);
        listDiv.innerHTML = "";
        if (snap.empty) {
            listDiv.innerHTML = "目前沒有任何設定。";
            return;
        }

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style.background = "#555";
            div.style.padding = "10px";
            div.style.marginBottom = "10px";
            div.style.borderRadius = "5px";
            div.innerHTML = `
                <h3 style="margin-top:0;">[排序 ${data.order}] ${data.title} (應選 ${data.max_votes} 人)</h3>
                <p style="color:#aaa;">候選人: ${data.candidates.join(', ')}</p>
                <button data-id="${docSnap.id}" class="del-btn" style="background:#dc3545; padding: 5px 10px;">刪除此職位</button>
            `;
            listDiv.appendChild(div);
        });

        document.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-id');
                if (confirm("確定要刪除嗎？")) {
                    await deleteDoc(doc(db, "ElectionRoles", docId));
                    loadRoles();
                }
            });
        });
    } catch (error) {
        listDiv.innerHTML = "讀取失敗，請確認是否已清空舊的無 order 資料。";
    }
}
loadRoles();

// 3. 新增職位 (包含順序)
document.getElementById('add-role-btn').addEventListener('click', async () => {
    const title = document.getElementById('role-title').value.trim();
    const max = parseInt(document.getElementById('role-max').value);
    const orderNum = parseInt(document.getElementById('role-order').value) || 99;
    const candStr = document.getElementById('role-candidates').value.trim();

    if (!title || !max || !candStr) {
        alert("請將資料填寫完整！");
        return;
    }
    const candArray = candStr.split(',').map(name => name.trim()).filter(name => name !== "");

    try {
        await addDoc(collection(db, "ElectionRoles"), {
            title: title,
            max_votes: max,
            candidates: candArray,
            order: orderNum
        });
        alert("新增成功！");
        document.getElementById('role-title').value = "";
        document.getElementById('role-max').value = "";
        //document.getElementById('role-candidates').value = "";
        loadRoles(); 
    } catch (error) {
        alert("新增失敗。");
    }
});

// 4. 開票邏輯
document.getElementById('tally-btn').addEventListener('click', async (e) => {
    const resultDiv = document.getElementById('tally-result');
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "努力計算中...";
    e.target.disabled = true;

    try {
        const votesSnap = await getDocs(collection(db, "Votes"));
        if (votesSnap.empty) {
            resultDiv.innerHTML = "目前還沒有任何人投票喔！";
            e.target.disabled = false;
            return;
        }

        const voteCounts = {};
        let totalBallots = 0;

        votesSnap.forEach(doc => {
            totalBallots++;
            const ballot = doc.data(); 
            for (const[role, candidates] of Object.entries(ballot)) {
                if (!voteCounts[role]) voteCounts[role] = {}; 
                candidates.forEach(candidate => {
                    if (!voteCounts[role][candidate]) voteCounts[role][candidate] = 0;
                    voteCounts[role][candidate]++;
                });
            }
        });

        currentTallyResult = voteCounts; 

        let html = `<h3 style="color:#007bff; border-bottom: 2px solid #ccc; padding-bottom: 5px;">總投票人數：${totalBallots} 人</h3>`;
        for (const[role, counts] of Object.entries(voteCounts)) {
            html += `<h4 style="margin-bottom: 5px; margin-top: 15px;">${role}</h4><ul style="margin-top: 0;">`;
            const sortedCandidates = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            for (const [candidate, votes] of sortedCandidates) {
                html += `<li style="font-size: 18px; margin-bottom: 5px;">${candidate}：<strong style="color: #dc3545; font-size: 22px;">${votes}</strong> 票</li>`;
            }
            html += `</ul>`;
        }
        
        resultDiv.innerHTML = html;
        document.getElementById('export-btn').style.display = "inline-block"; 

    } catch (error) {
        resultDiv.innerHTML = "<p style='color:red;'>開票發生錯誤。</p>";
    }
    e.target.disabled = false;
});

// 5. 匯出詳細 Excel (包含明細)
document.getElementById('export-btn').addEventListener('click', async () => {
    if (Object.keys(currentTallyResult).length === 0) return;

    let csvContent = "\uFEFF"; 
    csvContent += "--- 匿名選票明細 ---\n";
    csvContent += "選票編號,職位,勾選的候選人\n";
    
    const votesSnap = await getDocs(collection(db, "Votes"));
    let ticketIndex = 1;
    votesSnap.forEach(doc => {
        const ballot = doc.data();
        for (const [role, candidates] of Object.entries(ballot)) {
            csvContent += `第 ${ticketIndex} 票,${role},"${candidates.join(', ')}"\n`;
        }
        ticketIndex++;
    });

    csvContent += "\n\n--- 總得票數統計 ---\n";
    csvContent += "職位,候選人,得票數\n";

    for (const [role, counts] of Object.entries(currentTallyResult)) {
        const sortedCandidates = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        for (const [candidate, votes] of sortedCandidates) {
            csvContent += `${role},${candidate},${votes}\n`;
        }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "團契幹部選舉_詳細紀錄.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// 6. 換屆重置
document.getElementById('reset-system-btn').addEventListener('click', async () => {
    if (!confirm("⚠️ 警告：這個動作會永久刪除資料庫裡的「所有投票紀錄」與「所有密碼」！確定要刪除嗎？")) return;
    
    const checkWord = prompt("請輸入大寫字母 'DELETE' 來確認刪除：");
    if (checkWord !== "DELETE") {
        alert("輸入錯誤或取消，已終止刪除操作。");
        return;
    }

    const btn = document.getElementById('reset-system-btn');
    btn.textContent = "資料清除中，請勿關閉網頁...";
    btn.disabled = true;

    try {
        const votesSnap = await getDocs(collection(db, "Votes"));
        votesSnap.forEach(async (d) => { await deleteDoc(doc(db, "Votes", d.id)); });

        const codesSnap = await getDocs(collection(db, "AccessCodes"));
        codesSnap.forEach(async (d) => { await deleteDoc(doc(db, "AccessCodes", d.id)); });

        alert("✅ 系統重置成功！舊的選票與密碼已經全部清空。");
        document.getElementById('tally-result').innerHTML = ""; 
        document.getElementById('export-btn').style.display = "none";
    } catch (error) {
        alert("刪除過程中發生錯誤。");
    }
    btn.textContent = "一鍵清空選票與密碼庫";
    btn.disabled = false;
});