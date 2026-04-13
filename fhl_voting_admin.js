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

let editingRoleId = null; 
let isSystemOpen = false; 
let isCodesVisible = false; 

function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// --- 系統開關與密碼管理 (保留不變) ---
onSnapshot(doc(db, "SystemSettings", "global"), (snap) => {
    const statusText = document.getElementById('status-display');
    if (snap.exists()) isSystemOpen = snap.data().isVotingOpen;
    else isSystemOpen = true; 
    statusText.textContent = isSystemOpen ? "✅ 開放投票中" : "⛔ 已關閉投票";
    statusText.style.color = isSystemOpen ? "#28a745" : "#dc3545";
});

document.getElementById('toggle-system-btn').addEventListener('click', async () => {
    try { await setDoc(doc(db, "SystemSettings", "global"), { isVotingOpen: !isSystemOpen }); } 
    catch (error) { alert("切換失敗"); }
});

document.getElementById('generate-codes-btn').addEventListener('click', async (e) => {
    const amount = parseInt(document.getElementById('code-amount').value) || 30;
    if (!confirm(`確定要產生 ${amount} 組新密碼嗎？`)) return;
    e.target.disabled = true; e.target.textContent = "產生中...";
    try {
        for (let i = 0; i < amount; i++) await setDoc(doc(db, "AccessCodes", generateRandomCode()), { isUsed: false });
        alert(`${amount} 組密碼產生成功！`);
        if (isCodesVisible) loadAndDisplayCodes();
    } catch (error) { alert("產生錯誤！"); }
    e.target.disabled = false; e.target.textContent = "隨機產生新密碼";
});

document.getElementById('toggle-codes-btn').addEventListener('click', (e) => {
    isCodesVisible = !isCodesVisible;
    const wrapper = document.getElementById('codes-wrapper');
    const exportBtn = document.getElementById('export-codes-btn');
    if (isCodesVisible) {
        e.target.textContent = "隱藏密碼"; wrapper.style.display = "block"; exportBtn.style.display = "inline-block";
        loadAndDisplayCodes();
    } else {
        e.target.textContent = "顯示密碼"; wrapper.style.display = "none"; exportBtn.style.display = "none";
    }
});

async function loadAndDisplayCodes() {
    const displayDiv = document.getElementById('codes-display');
    const infoText = document.getElementById('codes-info');
    displayDiv.innerHTML = "讀取中...";
    try {
        const snap = await getDocs(collection(db, "AccessCodes"));
        if (snap.empty) { displayDiv.innerHTML = "目前沒有任何密碼。"; infoText.textContent = ""; return; }
        infoText.textContent = `總計 ${snap.size} 組密碼 (綠色可用，紅色已作廢)`;
        let html = '';
        snap.forEach(docSnap => {
            const cssClass = docSnap.data().isUsed ? "code-used" : "code-unused";
            html += `<div class="code-item ${cssClass}">${docSnap.id}</div>`;
        });
        displayDiv.innerHTML = html;
    } catch (error) { displayDiv.innerHTML = "讀取失敗"; }
}

document.getElementById('export-codes-btn').addEventListener('click', async () => {
    let csvContent = "\uFEFF密碼,狀態\n";
    try {
        const snap = await getDocs(collection(db, "AccessCodes"));
        snap.forEach(docSnap => { csvContent += `${docSnap.id},${docSnap.data().isUsed ? "已使用" : "可使用"}\n`; });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
        link.download = "信望愛幹部選舉_投票密碼清單.csv";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { alert("匯出失敗"); }
});

// --- 職位管理 (保留不變) ---
async function loadRoles() {
    const listDiv = document.getElementById('current-roles-list');
    listDiv.innerHTML = "讀取中...";
    try {
        const snap = await getDocs(query(collection(db, "ElectionRoles"), orderBy("order", "asc")));
        listDiv.innerHTML = "";
        if (snap.empty) { listDiv.innerHTML = "目前沒有任何設定。"; return; }
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style.background = "#555"; div.style.padding = "10px"; div.style.marginBottom = "10px"; div.style.borderRadius = "5px";
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
                addBtn.textContent = "💾 儲存修改"; addBtn.style.background = "#ffc107"; addBtn.style.color = "#000";
                document.getElementById('cancel-edit-btn').style.display = "block";
                window.scrollTo(0, 0); 
            });
        });
        document.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("確定要刪除嗎？")) { await deleteDoc(doc(db, "ElectionRoles", e.target.getAttribute('data-id'))); loadRoles(); }
            });
        });
    } catch (error) { listDiv.innerHTML = "讀取失敗"; }
}
loadRoles();

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editingRoleId = null;
    document.getElementById('role-title').value = ""; document.getElementById('role-max').value = "";
    const addBtn = document.getElementById('add-role-btn');
    addBtn.textContent = "新增 / 儲存職位"; addBtn.style.background = "#28a745"; addBtn.style.color = "#fff";
    document.getElementById('cancel-edit-btn').style.display = "none";
});

document.getElementById('add-role-btn').addEventListener('click', async () => {
    const title = document.getElementById('role-title').value.trim();
    const max = parseInt(document.getElementById('role-max').value);
    const orderNum = parseInt(document.getElementById('role-order').value) || 99;
    const candStr = document.getElementById('role-candidates').value.trim();
    if (!title || !max || !candStr) { alert("請將資料填寫完整！"); return; }
    const candArray = candStr.split(',').map(name => name.trim()).filter(name => name !== "");
    try {
        if (editingRoleId) await updateDoc(doc(db, "ElectionRoles", editingRoleId), { title: title, max_votes: max, candidates: candArray, order: orderNum });
        else await addDoc(collection(db, "ElectionRoles"), { title: title, max_votes: max, candidates: candArray, order: orderNum });
        alert("儲存成功！");
        document.getElementById('cancel-edit-btn').click();
        loadRoles(); 
    } catch (error) { alert("儲存失敗。"); }
});

// ==========================================
// ★ 升級 1：後台開票預覽 (僅顯示「當選人數」)
// ==========================================
document.getElementById('tally-btn').addEventListener('click', async (e) => {
    const resultDiv = document.getElementById('tally-result');
    resultDiv.style.display = "block"; resultDiv.innerHTML = "努力計算中..."; e.target.disabled = true;
    
    try {
        const qRoles = query(collection(db, "ElectionRoles"), orderBy("order", "asc"));
        const rolesSnap = await getDocs(qRoles);
        let orderedRoles =[];
        rolesSnap.forEach(doc => orderedRoles.push({ title: doc.data().title, max: doc.data().max_votes }));

        const votesSnap = await getDocs(collection(db, "Votes"));
        if (votesSnap.empty) { resultDiv.innerHTML = "目前還沒有任何人投票喔！"; e.target.disabled = false; return; }

        const voteCounts = {};
        let totalBallots = 0;
        votesSnap.forEach(doc => {
            totalBallots++;
            const ballot = doc.data(); 
            for (const[role, candidates] of Object.entries(ballot)) {
                if (!voteCounts[role]) voteCounts[role] = {}; 
                candidates.forEach(c => {
                    if (!voteCounts[role][c]) voteCounts[role][c] = 0;
                    voteCounts[role][c]++;
                });
            }
        });
        
        let html = `<h3 style="color:#007bff; border-bottom: 2px solid #ccc; padding-bottom: 5px;">總投票人數：${totalBallots} 人</h3>`;
        
        orderedRoles.forEach(r => {
            const role = r.title;
            const max = r.max;
            if (voteCounts[role]) {
                const counts = voteCounts[role];
                // 標題改為綠色顯示當選名單
                html += `<h4 style="margin-bottom: 5px; margin-top: 15px; color: #137333;">✅ [當選名單] ${role} (應選 ${max} 人)</h4><ul style="margin-top: 0;">`;
                const sortedCandidates = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                
                // ★ 核心修改：用 slice(0, max) 截斷陣列，只顯示前 max 名
                const winners = sortedCandidates.slice(0, max);
                
                for (const[candidate, votes] of winners) {
                    html += `<li style="font-size: 18px; margin-bottom: 5px;">${candidate}：<strong style="color: #dc3545; font-size: 22px;">${votes}</strong> 票</li>`;
                }
                html += `</ul>`;
            }
        });

        resultDiv.innerHTML = html;
        document.getElementById('export-btn').style.display = "inline-block"; 
    } catch (error) { resultDiv.innerHTML = "<p style='color:red;'>開票發生錯誤。</p>"; }
    e.target.disabled = false;
});

// ==========================================
// ★ 升級 2：匯出為「支援手機開啟」的超美彩色網頁報表 (.html)
// ==========================================
document.getElementById('export-btn').addEventListener('click', async () => {
    try {
        const qRoles = query(collection(db, "ElectionRoles"), orderBy("order", "asc"));
        const rolesSnap = await getDocs(qRoles);
        let orderedRoles =[];
        let allCandidatesSet = new Set();
        let globalMaxWinners = 0; 
        
        rolesSnap.forEach(doc => {
            const data = doc.data();
            orderedRoles.push({ title: data.title, max: data.max_votes });
            if (data.max_votes > globalMaxWinners) globalMaxWinners = data.max_votes;
            data.candidates.forEach(c => allCandidatesSet.add(c));
        });
        const allCandidates = Array.from(allCandidatesSet);

        const votesSnap = await getDocs(collection(db, "Votes"));
        if(votesSnap.empty) { alert("目前沒有選票可匯出"); return; }

        let matrix = {}; let roleTotals = {}; 
        allCandidates.forEach(c => { matrix[c] = {}; orderedRoles.forEach(r => matrix[c][r.title] = 0); });
        orderedRoles.forEach(r => roleTotals[r.title] = {});

        let ticketsData = {}; 
        let ticketIndex = 1;
        votesSnap.forEach(doc => {
            const ballot = doc.data();
            const tId = `第 ${ticketIndex} 票`;
            ticketsData[tId] =[];
            for (const [role, candidates] of Object.entries(ballot)) {
                ticketsData[tId].push({ role: role, cands: candidates.join(', ') });
                candidates.forEach(candidate => {
                    if (matrix[candidate] !== undefined && matrix[candidate][role] !== undefined) matrix[candidate][role]++;
                    if (!roleTotals[role]) roleTotals[role] = {};
                    if (!roleTotals[role][candidate]) roleTotals[role][candidate] = 0;
                    roleTotals[role][candidate]++;
                });
            }
            ticketIndex++;
        });

        // 建立完整且適應手機的 HTML 網頁代碼
        let html = `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0"> <!-- ★ 讓手機版完美顯示的關鍵 -->
            <title>信望愛幹部選舉 - 最終開票報表</title>
            <style>
                body { font-family: '微軟正黑體', sans-serif; padding: 20px; background: #f0f2f5; margin: 0; }
                .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow-x: auto; margin-bottom: 30px; }
                h1 { text-align: center; color: #333; }
                table { border-collapse: collapse; white-space: nowrap; margin-bottom: 20px; min-width: 100%; }
                th, td { border: 1px solid #ccc; padding: 10px 15px; text-align: center; vertical-align: middle; }
                .title-row { background-color: #0056b3; color: white; font-size: 18px; font-weight: bold; text-align: left; }
                .winner { background-color: #e6f4ea; color: #137333; font-weight: bold; }
                .alternate { background-color: #fff3cd; color: #856404; font-weight: bold; }
                .empty-cell { background-color: #f8f9fa; color: #ccc; } 
                .matrix-head { background-color: #f1f3f4; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>📊 信望愛幹部選舉 - 最終開票報表</h1>
            <div class="container">
        `;

        // --- 區塊 1 ---
        html += `<table>`;
        const totalTopCols = 2 + (globalMaxWinners * 3) + (2 * 3); 
        html += `<tr><td colspan="${totalTopCols}" class="title-row">🏆 最終得票統計與當選預測 (正取與候補)</td></tr>`;
        html += `<tr><th rowspan="2">職位</th><th rowspan="2">(應選人數)</th>`;
        for(let i=0; i<globalMaxWinners; i++) html += `<th colspan="3" style="background:#d4edda; color:#155724;">正取 ${i+1}</th>`;
        for(let i=0; i<2; i++) html += `<th colspan="3" style="background:#fff3cd; color:#856404;">候補 ${i+1}</th>`;
        html += `</tr><tr>`;
        for(let i=0; i<globalMaxWinners + 2; i++) html += `<th>當選狀態</th><th>候選人姓名</th><th>得票數</th>`;
        html += `</tr>`;

        orderedRoles.forEach(r => {
            const role = r.title; const max = r.max;
            let rowHtml = `<tr><td><strong>${role}</strong></td><td>${max} 人</td>`;
            const sorted = roleTotals[role] ? Object.entries(roleTotals[role]).sort((a,b)=>b[1]-a[1]) :[];

            for (let i = 0; i < globalMaxWinners; i++) {
                if (i < max && i < sorted.length) rowHtml += `<td class="winner">正取 ${i+1}</td><td><strong>${sorted[i][0]}</strong></td><td><strong style="color:red; font-size:18px;">${sorted[i][1]}</strong></td>`;
                else if (i < max) rowHtml += `<td class="winner">正取 ${i+1}</td><td class="empty-cell">-</td><td class="empty-cell">-</td>`;
                else rowHtml += `<td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td>`;
            }
            for (let i = 0; i < 2; i++) {
                let sIdx = max + i;
                if (sIdx < sorted.length) rowHtml += `<td class="alternate">候補 ${i+1}</td><td><strong>${sorted[sIdx][0]}</strong></td><td><strong>${sorted[sIdx][1]}</strong></td>`;
                else rowHtml += `<td class="alternate">候補 ${i+1}</td><td class="empty-cell">-</td><td class="empty-cell">-</td>`;
            }
            rowHtml += `</tr>`; html += rowHtml;
        });
        html += `</table></div><div class="container">`;

        // --- 區塊 2 ---
        html += `<table>`;
        html += `<tr><td colspan="${orderedRoles.length + 1}" class="title-row">📈 候選人得票交叉分析矩陣</td></tr>`;
        html += `<tr><th class="matrix-head">候選人 \\ 職位</th>`;
        orderedRoles.forEach(r => html += `<th class="matrix-head">${r.title}</th>`);
        html += `</tr>`;

        allCandidates.forEach(cand => {
            html += `<tr><td class="matrix-head">${cand}</td>`;
            orderedRoles.forEach(r => {
                const v = matrix[cand][r.title] || 0;
                const cellStyle = v > 0 ? "font-weight: bold; color: #d32f2f; font-size:16px;" : "color: #ccc;";
                html += `<td style="${cellStyle}">${v}</td>`;
            });
            html += `</tr>`;
        });
        html += `</table></div><div class="container">`;

        // --- 區塊 3 ---
        html += `<table>`;
        html += `<tr><td colspan="15" class="title-row">📝 原始匿名選票明細 (供稽核使用)</td></tr>`;

        const tickets = Object.keys(ticketsData); 
        const chunkedTickets =[];
        for (let i = 0; i < tickets.length; i += 4) chunkedTickets.push(tickets.slice(i, i + 4));

        chunkedTickets.forEach(chunk => {
            let maxRows = 0;
            chunk.forEach(tId => { if (ticketsData[tId].length > maxRows) maxRows = ticketsData[tId].length; });

            html += `<tr>`;
            chunk.forEach((tId, idx) => {
                html += `<th>選票編號</th><th>填寫職位</th><th>勾選的候選人</th>`;
                if (idx < chunk.length - 1) html += `<th style="border: none; min-width: 20px;"></th>`; 
            });
            html += `</tr>`;

            for (let r = 0; r < maxRows; r++) {
                html += `<tr>`;
                chunk.forEach((tId, idx) => {
                    const rowData = ticketsData[tId][r];
                    if (rowData) html += `<td><strong>${tId}</strong></td><td>${rowData.role}</td><td style="text-align: left;">${rowData.cands}</td>`;
                    else html += `<td></td><td></td><td></td>`; 
                    if (idx < chunk.length - 1) html += `<td style="border: none;"></td>`; 
                });
                html += `</tr>`;
            }
            html += `<tr><td colspan="15" style="border: none; border-bottom: 3px solid #ccc; height: 10px;"></td></tr>`;
        });

        html += `</table></div></body></html>`;

        // ★ 核心修改：改存為 .html 網頁檔案
        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "信望愛幹部選舉_完美開票報表.html"; 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);

    } catch (error) {
        alert("匯出發生錯誤");
        console.error(error);
    }
});

// 4. 換屆重置 (保留不變)
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