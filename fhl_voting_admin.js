import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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
let editingRoleId = null; 
let isSystemOpen = false; 
let isCodesVisible = false; 

function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// 0. 即時監聽系統開關
onSnapshot(doc(db, "SystemSettings", "global"), (snap) => {
    const statusText = document.getElementById('status-display');
    if (snap.exists()) {
        isSystemOpen = snap.data().isVotingOpen;
    } else {
        isSystemOpen = true; 
    }
    statusText.textContent = isSystemOpen ? "✅ 開放投票中" : "⛔ 已關閉投票";
    statusText.style.color = isSystemOpen ? "#28a745" : "#dc3545";
});

document.getElementById('toggle-system-btn').addEventListener('click', async () => {
    try {
        const newState = !isSystemOpen;
        await setDoc(doc(db, "SystemSettings", "global"), { isVotingOpen: newState });
    } catch (error) {
        alert("切換失敗");
    }
});

// 1. 密碼產生、隱藏與匯出
document.getElementById('generate-codes-btn').addEventListener('click', async (e) => {
    const amount = parseInt(document.getElementById('code-amount').value) || 30;
    if (!confirm(`確定要產生 ${amount} 組新密碼嗎？`)) return;
    
    e.target.disabled = true;
    e.target.textContent = "產生中...";

    try {
        for (let i = 0; i < amount; i++) {
            const newCode = generateRandomCode();
            await setDoc(doc(db, "AccessCodes", newCode), { isUsed: false });
        }
        alert(`${amount} 組密碼產生成功！`);
        
        if (isCodesVisible) loadAndDisplayCodes();
    } catch (error) {
        alert("產生錯誤！");
    }
    e.target.disabled = false;
    e.target.textContent = "隨機產生新密碼";
});

document.getElementById('toggle-codes-btn').addEventListener('click', (e) => {
    isCodesVisible = !isCodesVisible;
    const wrapper = document.getElementById('codes-wrapper');
    const exportBtn = document.getElementById('export-codes-btn');
    
    if (isCodesVisible) {
        e.target.textContent = "隱藏密碼";
        wrapper.style.display = "block";
        exportBtn.style.display = "inline-block";
        loadAndDisplayCodes();
    } else {
        e.target.textContent = "顯示密碼";
        wrapper.style.display = "none";
        exportBtn.style.display = "none";
    }
});

async function loadAndDisplayCodes() {
    const displayDiv = document.getElementById('codes-display');
    const infoText = document.getElementById('codes-info');
    displayDiv.innerHTML = "讀取中...";
    try {
        const snap = await getDocs(collection(db, "AccessCodes"));
        if (snap.empty) {
            displayDiv.innerHTML = "目前沒有任何密碼。";
            infoText.textContent = "";
            return;
        }
        infoText.textContent = `總計 ${snap.size} 組密碼 (綠色可用，紅色已作廢)`;
        let html = '';
        snap.forEach(docSnap => {
            const isUsed = docSnap.data().isUsed;
            const cssClass = isUsed ? "code-used" : "code-unused";
            html += `<div class="code-item ${cssClass}">${docSnap.id}</div>`;
        });
        displayDiv.innerHTML = html;
    } catch (error) {
        displayDiv.innerHTML = "讀取失敗";
    }
}

document.getElementById('export-codes-btn').addEventListener('click', async () => {
    let csvContent = "\uFEFF密碼,狀態\n";
    try {
        const snap = await getDocs(collection(db, "AccessCodes"));
        snap.forEach(docSnap => {
            const isUsed = docSnap.data().isUsed ? "已使用(作廢)" : "可使用";
            csvContent += `${docSnap.id},${isUsed}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "團契選舉_投票密碼清單.csv";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) {
        alert("匯出失敗");
    }
});

// 2. 讀取、新增與「編輯」職位
async function loadRoles() {
    const listDiv = document.getElementById('current-roles-list');
    listDiv.innerHTML = "讀取中...";
    try {
        const q = query(collection(db, "ElectionRoles"), orderBy("order", "asc"));
        const snap = await getDocs(q);
        listDiv.innerHTML = "";
        if (snap.empty) { listDiv.innerHTML = "目前沒有任何設定。"; return; }

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
                <button data-id="${docSnap.id}" class="edit-btn" style="background:#ffc107; color:#000; padding: 5px 10px;">編輯</button>
                <button data-id="${docSnap.id}" class="del-btn" style="background:#dc3545; padding: 5px 10px; margin-left: 5px;">刪除</button>
            `;
            listDiv.appendChild(div);

            div.querySelector('.edit-btn').addEventListener('click', () => {
                editingRoleId = docSnap.id;
                document.getElementById('role-title').value = data.title;
                document.getElementById('role-max').value = data.max_votes;
                document.getElementById('role-order').value = data.order;
                document.getElementById('role-candidates').value = data.candidates.join(', ');
                
                const addBtn = document.getElementById('add-role-btn');
                addBtn.textContent = "💾 儲存修改";
                addBtn.style.background = "#ffc107";
                addBtn.style.color = "#000";
                document.getElementById('cancel-edit-btn').style.display = "block";
                window.scrollTo(0, 0); 
            });
        });

        document.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("確定要刪除嗎？")) {
                    await deleteDoc(doc(db, "ElectionRoles", e.target.getAttribute('data-id')));
                    loadRoles();
                }
            });
        });
    } catch (error) { listDiv.innerHTML = "讀取失敗"; }
}
loadRoles();

document.getElementById('cancel-edit-btn').addEventListener('click', () => { resetEditForm(); });

function resetEditForm() {
    editingRoleId = null;
    document.getElementById('role-title').value = "";
    document.getElementById('role-max').value = "";
    const addBtn = document.getElementById('add-role-btn');
    addBtn.textContent = "新增 / 儲存職位";
    addBtn.style.background = "#28a745";
    addBtn.style.color = "#fff";
    document.getElementById('cancel-edit-btn').style.display = "none";
}

document.getElementById('add-role-btn').addEventListener('click', async () => {
    const title = document.getElementById('role-title').value.trim();
    const max = parseInt(document.getElementById('role-max').value);
    const orderNum = parseInt(document.getElementById('role-order').value) || 99;
    const candStr = document.getElementById('role-candidates').value.trim();

    if (!title || !max || !candStr) { alert("請將資料填寫完整！"); return; }
    const candArray = candStr.split(',').map(name => name.trim()).filter(name => name !== "");

    try {
        if (editingRoleId) {
            await updateDoc(doc(db, "ElectionRoles", editingRoleId), {
                title: title, max_votes: max, candidates: candArray, order: orderNum
            });
            alert("修改成功！");
        } else {
            await addDoc(collection(db, "ElectionRoles"), {
                title: title, max_votes: max, candidates: candArray, order: orderNum
            });
            alert("新增成功！");
        }
        resetEditForm();
        loadRoles(); 
    } catch (error) { alert("儲存失敗。"); }
});

// 3. 開票與匯出結果
document.getElementById('tally-btn').addEventListener('click', async (e) => {
    const resultDiv = document.getElementById('tally-result');
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "努力計算中...";
    e.target.disabled = true;
    try {
        const votesSnap = await getDocs(collection(db, "Votes"));
        if (votesSnap.empty) { resultDiv.innerHTML = "目前還沒有任何人投票喔！"; e.target.disabled = false; return; }

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
    } catch (error) { resultDiv.innerHTML = "<p style='color:red;'>開票發生錯誤。</p>"; }
    e.target.disabled = false;
});

document.getElementById('export-btn').addEventListener('click', async () => {
    if (Object.keys(currentTallyResult).length === 0) return;
    let csvContent = "\uFEFF--- 匿名選票明細 ---\n選票編號,職位,勾選的候選人\n";
    const votesSnap = await getDocs(collection(db, "Votes"));
    let ticketIndex = 1;
    votesSnap.forEach(doc => {
        const ballot = doc.data();
        for (const[role, candidates] of Object.entries(ballot)) {
            csvContent += `第 ${ticketIndex} 票,${role},"${candidates.join(', ')}"\n`;
        }
        ticketIndex++;
    });
    csvContent += "\n\n--- 總得票數統計 ---\n職位,候選人,得票數\n";
    for (const[role, counts] of Object.entries(currentTallyResult)) {
        const sortedCandidates = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        for (const[candidate, votes] of sortedCandidates) { csvContent += `${role},${candidate},${votes}\n`; }
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "團契幹部選舉_開票結果.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// 4. 換屆重置
document.getElementById('reset-system-btn').addEventListener('click', async () => {
    if (!confirm("⚠️ 警告：這個動作會永久刪除所有投票紀錄與密碼！確定要刪除嗎？")) return;
    if (prompt("請輸入 'DELETE' 來確認刪除：") !== "DELETE") return;
    const btn = document.getElementById('reset-system-btn');
    btn.textContent = "資料清除中..."; btn.disabled = true;
    try {
        const votesSnap = await getDocs(collection(db, "Votes"));
        votesSnap.forEach(async (d) => { await deleteDoc(doc(db, "Votes", d.id)); });
        const codesSnap = await getDocs(collection(db, "AccessCodes"));
        codesSnap.forEach(async (d) => { await deleteDoc(doc(db, "AccessCodes", d.id)); });
        alert("✅ 系統重置成功！");
        document.getElementById('tally-result').innerHTML = ""; 
        document.getElementById('export-btn').style.display = "none";
        
        if (isCodesVisible) loadAndDisplayCodes();
    } catch (error) { alert("刪除失敗。"); }
    btn.textContent = "一鍵清空選票與密碼庫"; btn.disabled = false;
});