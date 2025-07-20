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
       item.textContent = `${p.pid} (AT: ${p.arrivalTime}, BT: ${p.burstTime})`;
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

        const shortest = ready.reduce((a, b) => a.remainingTime < b.remainingTime ? a : b);

        if (!(shortest.pid in started)) {
            shortest.responseTime = currentTime - shortest.arrivalTime;
            started[shortest.pid] = true;
        }

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
    function runRoundRobin(quantum) {
    if (isNaN(quantum) || quantum <= 0) {
        alert("Please enter a valid quantum time.");
        return;
    }

    const queue = [...processes].map(p => ({ ...p }));
    const result = [];
    const readyQueue = [];
    const started = {};
    let currentTime = 0;
    let arrivedIndex = 0;

    
    queue.sort((a, b) => a.arrivalTime - b.arrivalTime);


    function enqueueNewArrivals() {
        while (arrivedIndex < queue.length && queue[arrivedIndex].arrivalTime <= currentTime) {
            readyQueue.push(queue[arrivedIndex]);
            arrivedIndex++;
        }
    }

    enqueueNewArrivals();

    while (queue.some(p => p.remainingTime > 0) || readyQueue.length > 0) {
        if (readyQueue.length === 0) {
         
            const nextArrival = queue.find(p => p.remainingTime > 0 && p.arrivalTime > currentTime);
            const idleEnd = nextArrival ? nextArrival.arrivalTime : currentTime + 1;
            result.push({ pid: 'IDLE', start: currentTime, end: idleEnd });
            currentTime = idleEnd;
            enqueueNewArrivals();
            continue;
        }

        const currentProcess = readyQueue.shift();

       
        if (!(currentProcess.pid in started)) {
            currentProcess.responseTime = currentTime - currentProcess.arrivalTime;
            started[currentProcess.pid] = true;
        }

        const execTime = Math.min(quantum, currentProcess.remainingTime);
        const startTime = currentTime;
        const endTime = currentTime + execTime;

        result.push({ pid: currentProcess.pid, start: startTime, end: endTime });

        currentTime = endTime;
        currentProcess.remainingTime -= execTime;

        enqueueNewArrivals(); 

        
        if (currentProcess.remainingTime > 0) {
            readyQueue.push(currentProcess);
        }
    }

    displayGantt(result);
    calculateMetrics(result);
}

function runMLFQ() {
    const queueCount = 4;
    const quantums = [];
    const allotments = [];

    for (let i = 0; i < queueCount; i++) {
        quantums[i] = parseInt(document.getElementById(`quantumQ${i}`).value, 10);
        allotments[i] = parseInt(document.getElementById(`allotmentQ${i}`).value, 10);
        if (isNaN(quantums[i]) || isNaN(allotments[i]) || quantums[i] <= 0 || allotments[i] <= 0) {
            alert(`Invalid quantum or allotment in Q${i}`);
            return;
        }
    }

    const queue = [...processes].map(p => ({ ...p, queueLevel: 0, allotmentUsed: 0 }));
    const result = [];
    const readyQueues = [[], [], [], []];
    const started = {};
    let currentTime = 0;
    let arrivedIndex = 0;

    queue.sort((a, b) => a.arrivalTime - b.arrivalTime);

    function enqueueNewArrivals() {
        while (arrivedIndex < queue.length && queue[arrivedIndex].arrivalTime <= currentTime) {
            readyQueues[0].push(queue[arrivedIndex]);
            arrivedIndex++;
        }
    }

    enqueueNewArrivals();

    while (queue.some(p => p.remainingTime > 0)) {
        enqueueNewArrivals();

        let currentProcess = null;
        let currentLevel = -1;

        for (let i = 0; i < queueCount; i++) {
            if (readyQueues[i].length > 0) {
                currentProcess = readyQueues[i].shift();
                currentLevel = i;
                break;
            }
        }

        if (!currentProcess) {
            result.push({ pid: 'IDLE', start: currentTime, end: currentTime + 1 });
            currentTime++;
            continue;
        }

        if (!(currentProcess.pid in started)) {
            currentProcess.responseTime = currentTime - currentProcess.arrivalTime;
            started[currentProcess.pid] = true;
        }

        const execTime = Math.min(quantums[currentLevel], currentProcess.remainingTime);
        const startTime = currentTime;
        const endTime = currentTime + execTime;

        result.push({ pid: currentProcess.pid, start: startTime, end: endTime });
        currentTime = endTime;
        currentProcess.remainingTime -= execTime;
        currentProcess.allotmentUsed += execTime;

        enqueueNewArrivals();

        if (currentProcess.remainingTime > 0) {
            if (currentProcess.allotmentUsed >= allotments[currentLevel] && currentLevel < queueCount - 1) {
                currentProcess.queueLevel++;
                currentProcess.allotmentUsed = 0;
                readyQueues[currentLevel + 1].push(currentProcess);
            } else {
                readyQueues[currentLevel].push(currentProcess);
            }
        }
    }

    displayGantt(result);
    calculateMetrics(result);
}

function displayGantt(schedule) {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = '';

    const totalTime = schedule[schedule.length - 1].end;

    // Render time labels BEFORE the Gantt chart blocks
    renderTimeLabels(totalTime);

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
function renderTimeLabels(totalTime) {
    const labelContainer = document.getElementById('time-labels');
    labelContainer.innerHTML = '';

    for (let i = 0; i <= totalTime; i++) {
        const label = document.createElement('span');
        label.innerText = i;
        label.style.display = 'inline-block';
        label.style.width = '61px'; // Must match width per time unit
        label.style.textAlign = 'center';
        label.style.fontSize = '12px';
        label.style.color = '#444';
        labelContainer.appendChild(label);
    }
}





