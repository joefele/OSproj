
let processes = [];

const colors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
    '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#343a40'
];

function getColor(id) {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    return !isNaN(num) ? colors[num % colors.length] : colors[0];
}

function refreshProcessList() {
    const div = document.getElementById('processList');
    div.innerHTML = '';
    if (processes.length === 0) {
        div.innerHTML = '<div class="no-processes">No processes added yet</div>';
        return;
    }
    processes.forEach(p => {
        const el = document.createElement('div');
        el.textContent = `ID: ${p.id}, Arrival: ${p.arrival}, Burst: ${p.burst}`;
        div.appendChild(el);
    });
}

function showResults(gantt, metrics) {
    document.getElementById('resultsSection').classList.remove('hidden');

    const ganttDiv = document.getElementById('ganttChart');
    ganttDiv.innerHTML = '';
    gantt.forEach(block => {
        const b = document.createElement('div');
        b.className = 'gantt-block';
        b.style.flex = block.length;
        b.textContent = `${block.id} (${block.start}-${block.end})`;
        b.style.backgroundColor = getColor(block.id);
        ganttDiv.appendChild(b);
    });

    const tbody = document.querySelector('#metricsTable tbody');
    tbody.innerHTML = '';
    metrics.forEach(m => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${m.id}</td>
            <td>${m.arrival}</td>
            <td>${m.burst}</td>
            <td>${m.completion}</td>
            <td>${m.turnaround}</td>
            <td>${m.response}</td>
        `;
        tbody.appendChild(row);
    });

    const avgResponse = metrics.reduce((a, v) => a + v.response, 0) / metrics.length;
    const avgTurn = metrics.reduce((a, v) => a + v.turnaround, 0) / metrics.length;
    document.getElementById('averageMetrics').textContent =
        `Avg Response Time: ${avgResponse.toFixed(2)}, Avg Turnaround Time: ${avgTurn.toFixed(2)}`;
}


function addProcess() {
    const id = document.getElementById('processId').value || `P${processes.length}`;
    const arrival = parseInt(document.getElementById('arrivalTime').value, 10);
    const burst = parseInt(document.getElementById('burstTime').value, 10);
    if (isNaN(arrival) || isNaN(burst)) {
        return alert('Please enter valid Arrival and Burst times.');
    }
    processes.push({ id, arrival, burst, remaining: burst });
    refreshProcessList();
}

function generateRandomProcesses() {
    const n = parseInt(document.getElementById('numProcesses').value, 10);
    processes = [];
    for (let i = 0; i < n; i++) {
        const burst = Math.floor(Math.random() * 10) + 1;
        const arrival = Math.floor(Math.random() * n);
        processes.push({ id: `P${i}`, arrival, burst, remaining: burst });
    }
    refreshProcessList();
}

function clearAll() {
    processes = [];
    document.getElementById('resultsSection').classList.add('hidden');
    refreshProcessList();
}

function runFCFS() {
    const q = [...processes].sort((a, b) => a.arrival - b.arrival);
    const gantt = [], metrics = [];
    let time = 0;
    q.forEach(p => {
        const start = Math.max(time, p.arrival);
        const end = start + p.burst;
        const turnaround = end - p.arrival;
        const waiting = turnaround - p.burst;
        const completion = end;
        const response = start - p.arrival;
        gantt.push({ id: p.id, start, end, length: p.burst });
        metrics.push({ ...p, completion, turnaround, waiting, response });
        time = end;
    });
    showResults(gantt, metrics);
}

function runSJFNonPreemptive() {
    const q = [...processes];
    const gantt = [], metrics = [];
    let time = 0, done = 0;
    while (done < q.length) {
        const ready = q.filter(p => !p.done && p.arrival <= time);
        if (ready.length === 0) {
            time++;
            continue;
        }
        const p = ready.sort((a, b) => a.burst - b.burst)[0];
        const start = time;
        const end = start + p.burst;
        const turnaround = end - p.arrival;
        const waiting = turnaround - p.burst;
        const completion = end;
        const response = start - p.arrival;
        gantt.push({ id: p.id, start, end, length: p.burst });
        metrics.push({ ...p, completion, turnaround, waiting, response });
        p.done = true;
        done++;
        time = end;
    }
    showResults(gantt, metrics);
}

function runSJFPreemptive() {
    const q = [...processes].map(p => ({ ...p, remaining: p.burst }));
    const gantt = [], metrics = [];
    let time = 0, done = 0, lastId = null;
    const firstResponse = {};

    while (done < q.length) {
        const ready = q.filter(p => p.arrival <= time && p.remaining > 0);
        if (ready.length === 0) {
            time++;
            continue;
        }
        const p = ready.sort((a, b) => a.remaining - b.remaining)[0];
        if (!firstResponse[p.id]) firstResponse[p.id] = time - p.arrival;
        if (lastId !== p.id) {
            gantt.push({ id: p.id, start: time, end: time + 1, length: 1 });
        } else {
            gantt[gantt.length - 1].end++;
            gantt[gantt.length - 1].length++;
        }
        p.remaining--;
        if (p.remaining === 0) {
            const completion = time + 1;
            const turnaround = completion - p.arrival;
            const waiting = turnaround - p.burst;
            const response = firstResponse[p.id];
            metrics.push({ ...p, completion, turnaround, waiting, response });
            done++;
        }
        lastId = p.id;
        time++;
    }
    showResults(gantt, metrics);
}

function runRoundRobin(quantum) {
    const q = [...processes].map(p => ({ ...p, remaining: p.burst }));
    const gantt = [], metrics = [];
    const queue = [], arrived = [], responseTime = {};
    let time = 0;

    while (metrics.length < q.length) {
        q.forEach(p => {
            if (p.arrival <= time && !arrived.includes(p)) {
                queue.push(p);
                arrived.push(p);
            }
        });
        if (queue.length === 0) {
            time++;
            continue;
        }
        const p = queue.shift();
        if (responseTime[p.id] === undefined) responseTime[p.id] = time - p.arrival;
        const exec = Math.min(quantum, p.remaining);
        const start = time;
        time += exec;
        p.remaining -= exec;
        gantt.push({ id: p.id, start, end: time, length: exec });
        q.forEach(proc => {
            if (proc.arrival <= time && !arrived.includes(proc)) {
                queue.push(proc);
                arrived.push(proc);
            }
        });
        if (p.remaining > 0) {
            queue.push(p);
        } else {
            const completion = time;
            const turnaround = completion - p.arrival;
            const waiting = turnaround - p.burst;
            const response = responseTime[p.id];
            metrics.push({ ...p, completion, turnaround, waiting, response });
        }
    }
    showResults(gantt, metrics);
}

function runMLFQ(quantum) {
    const q = [...processes].map(p => ({ ...p, remaining: p.burst, level: 0 }));
    const queues = [[], [], []];
    const gantt = [], metrics = [], responded = {};
    let time = 0;

    while (metrics.length < q.length) {
        q.forEach(p => {
            if (p.arrival <= time && !queues.flat().includes(p) && p.remaining > 0) {
                queues[0].push(p);
            }
        });
        let p = null;
        for (let i = 0; i < queues.length; i++) {
            if (queues[i].length > 0) {
                p = queues[i].shift();
                p.level = i;
                break;
            }
        }
        if (!p) {
            time++;
            continue;
        }
        if (!responded[p.id]) responded[p.id] = time - p.arrival;
        const slice = quantum * (p.level + 1);
        const exec = Math.min(slice, p.remaining);
        const start = time;
        time += exec;
        p.remaining -= exec;
        gantt.push({ id: p.id, start, end: time, length: exec });
        q.forEach(proc => {
            if (proc.arrival <= time && !queues.flat().includes(proc) && proc.remaining > 0) {
                queues[0].push(proc);
            }
        });
        if (p.remaining > 0) {
            p.level = Math.min(p.level + 1, 2);
            queues[p.level].push(p);
        } else {
            const completion = time;
            const turnaround = completion - p.arrival;
            const waiting = turnaround - p.burst;
            const response = responded[p.id];
            metrics.push({ ...p, completion, turnaround, waiting, response });
        }
    }
    showResults(gantt, metrics);
}
