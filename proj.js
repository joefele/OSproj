let processes = [];

const colors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
    '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#343a40'
];

function getColor(id) {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    return colors[num % colors.length];
}

function addProcess() {
    const pid = document.getElementById('processId').value || `P${processes.length}`;
    const arrivalTime = parseInt(document.getElementById('arrivalTime').value, 10);
    const burstTime = parseInt(document.getElementById('burstTime').value, 10);
    const priorityInput = document.getElementById('priority');
    const priority = priorityInput && !priorityInput.closest('#priorityField').classList.contains('hidden')
        ? parseInt(priorityInput.value, 10)
        : null;

    if (isNaN(arrivalTime) || isNaN(burstTime)) {
        alert("Please enter valid arrival and burst times.");
        return;
    }

    processes.push({ pid, arrivalTime, burstTime, remainingTime: burstTime, priority });
    updateProcessList();
}

function updateProcessList() {
    const container = document.getElementById('processList');
    container.innerHTML = '';

    if (processes.length === 0) {
        container.innerHTML = '<div class="no-processes">No processes added yet</div>';
        return;
    }

    processes.forEach(p => {
        const item = document.createElement('div');
        item.className = 'process-item';
        item.textContent = `${p.pid} (AT: ${p.arrivalTime}, BT: ${p.burstTime}${p.priority !== null ? `, Priority: ${p.priority}` : ''})`;
        container.appendChild(item);
    });
}

function clearAll() {
    processes = [];
    updateProcessList();
    document.getElementById('ganttChart').innerHTML = '';
    document.querySelector('#metricsTable tbody').innerHTML = '';
    document.getElementById('averageMetrics').innerHTML = '';
    document.getElementById('resultsSection').classList.add('hidden');
}

function generateRandomProcesses() {
    const num = parseInt(document.getElementById('numProcesses').value, 10);
    processes = [];

    for (let i = 0; i < num; i++) {
        processes.push({
            pid: `P${i}`,
            arrivalTime: Math.floor(Math.random() * 10),
            burstTime: Math.floor(Math.random() * 10) + 1,
            remainingTime: 0,
            priority: Math.floor(Math.random() * 5)
        });
    }

    processes.forEach(p => p.remainingTime = p.burstTime);
    updateProcessList();
}

function runFCFS() {
    const queue = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
    let currentTime = 0;
    const result = [];

    queue.forEach(p => {
        if (p.arrivalTime > currentTime) {
            result.push({ pid: 'IDLE', start: currentTime, end: p.arrivalTime });
            currentTime = p.arrivalTime;
        }

        const startTime = currentTime;
        const endTime = startTime + p.burstTime;

        result.push({ pid: p.pid, start: startTime, end: endTime });

        currentTime = endTime;
    });

    displayGantt(result);
    calculateMetrics(result);
}

function runSJFNonPreemptive() {
    console.log("Running SJF Non-Preemptive...");
    const queue = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
    const completed = [];
    let currentTime = 0;
    const result = [];

    while (completed.length < queue.length) {
        const ready = queue.filter(p => !completed.includes(p) && p.arrivalTime <= currentTime);

        if (ready.length === 0) {
            const nextArrival = queue.find(p => !completed.includes(p)).arrivalTime;
            result.push({ pid: 'IDLE', start: currentTime, end: nextArrival });
            currentTime = nextArrival;
            continue;
        }

        const nextProcess = ready.sort((a, b) => a.burstTime - b.burstTime)[0];
        const startTime = currentTime;
        const endTime = startTime + nextProcess.burstTime;

        result.push({ pid: nextProcess.pid, start: startTime, end: endTime });
        currentTime = endTime;
        completed.push(nextProcess);
    }

    displayGantt(result);
    calculateMetrics(result);
}

function runSJFPreemptive() {
    console.log("Running SJF Preemptive...");
    const queue = [...processes].map(p => ({ ...p }));
    let currentTime = 0;
    const result = [];
    let lastPid = null;

    // Track first response time
    const started = {};

    while (queue.some(p => p.remainingTime > 0)) {
        const ready = queue.filter(p => p.arrivalTime <= currentTime && p.remainingTime > 0);

        if (ready.length === 0) {
            if (lastPid !== 'IDLE') {
                result.push({ pid: 'IDLE', start: currentTime, end: currentTime + 1 });
                lastPid = 'IDLE';
            } else {
                result[result.length - 1].end++;
            }
            currentTime++;
            continue;
        }

        // Select process with shortest remaining time
        const shortest = ready.reduce((a, b) => a.remainingTime < b.remainingTime ? a : b);

        // Track response time once
        if (!(shortest.pid in started)) {
            shortest.responseTime = currentTime - shortest.arrivalTime;
            started[shortest.pid] = true;
        }

        // Handle process switching
        if (lastPid !== shortest.pid) {
            result.push({ pid: shortest.pid, start: currentTime, end: currentTime + 1 });
            lastPid = shortest.pid;
        } else {
            result[result.length - 1].end++;
        }

        shortest.remainingTime--;
        currentTime++;
    }

    displayGantt(result);
    calculateMetrics(result);
}



function simulate() {
    const algo = document.getElementById('algorithm').value;

    switch (algo) {
        case 'fcfs':
            runFCFS();
            break;
        case 'sjf-np':
            runSJFNonPreemptive();
            break;
        case 'sjf-p':
            runSJFPreemptive();
            break;
        default:
            alert("Please select a valid scheduling algorithm.");
    }
}

function displayGantt(schedule) {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = '';

    const totalTime = schedule[schedule.length - 1].end;
    schedule.forEach(item => {
        const block = document.createElement('div');
        block.className = 'gantt-block';
        block.textContent = item.pid;
        block.style.width = ((item.end - item.start) / totalTime) * 100 + '%';
        block.title = `${item.pid}: ${item.start} - ${item.end}`;

        if (item.pid === 'IDLE') {
            block.style.backgroundColor = '#cccccc';
            block.style.color = '#000';
        } else {
            block.style.backgroundColor = getColor(item.pid);
        }

        chart.appendChild(block);
    });
}

function calculateMetrics(schedule) {
    const tableBody = document.querySelector('#metricsTable tbody');
    const averages = {
        turnaround: 0,
        response: 0,
        count: processes.length
    };

    tableBody.innerHTML = '';

    processes.forEach(p => {
        // Get all Gantt entries for the process
        const ganttEntries = schedule.filter(s => s.pid === p.pid);

        // If process never ran
        if (ganttEntries.length === 0) return;

        const startTime = ganttEntries[0].start;
        const endTime = ganttEntries[ganttEntries.length - 1].end;

        const completionTime = endTime;
        const turnaroundTime = completionTime - p.arrivalTime;
        const responseTime = startTime - p.arrivalTime;

        averages.turnaround += turnaroundTime;
        averages.response += responseTime;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.pid}</td>
            <td>${p.arrivalTime}</td>
            <td>${p.burstTime}</td>
            <td>${completionTime}</td>
            <td>${turnaroundTime}</td>
            <td>${responseTime}</td>
        `;
        tableBody.appendChild(row);
    });

    const avgDiv = document.getElementById('averageMetrics');
    avgDiv.innerHTML = `
        <p><strong>Average Turnaround Time:</strong> ${(averages.turnaround / averages.count).toFixed(2)}</p>
        <p><strong>Average Response Time:</strong> ${(averages.response / averages.count).toFixed(2)}</p>
    `;

    document.getElementById('resultsSection').classList.remove('hidden');
}



