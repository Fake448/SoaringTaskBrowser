// Fetches task summaries and details from the soaring.siglr.com API
// and saves them to a JSON file.
// --------------------------------------------------
// Usage: node fetch_tasks_to_json.js
// --------------------------------------------------

const fs = require('fs');
const http = require('http');

const outputFile = 'test_all_tasks.json';
const listUrl = 'http://soaring.siglr.com/php/GetTasksForMap.php?taskCount=10';
const detailUrl = id => `http://soaring.siglr.com/php/GetTaskDetails.php?entrySeqID=${id}`;

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

(async () => {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

    try {
        // 1. Fetch 10 tasks (summary)
        const listData = await httpGet(listUrl);
        const parsed = JSON.parse(listData);
        const tasks = (parsed.tasks || parsed).slice(0, 10); // limit to 10

        // Extract meta info if present
        const totalTasks = parsed.totalTasks || tasks.length;
        const oldestDate = parsed.oldestDate || null;
        const newestDate = parsed.newestDate || null;

        // 2. Fetch details for each EntrySeqID
        const allDetails = [];
        for (const task of tasks) {
            const id = task.EntrySeqID;
            try {
                const detailData = await httpGet(detailUrl(id));
                const detail = JSON.parse(detailData);

                // Add IGCRecordCount from summary if present
                if (typeof task.IGCRecordCount !== "undefined") {
                    detail.IGCRecordCount = task.IGCRecordCount;
                }

                allDetails.push(detail);
            } catch (err) {
                console.error(`Failed to fetch details for EntrySeqID ${id}:`, err.message);
            }
        }

        // 3. Save all details with meta info
        fs.writeFileSync(
            outputFile,
            JSON.stringify(
                { tasks: allDetails, totalTasks, oldestDate, newestDate },
                null,
                2
            ),
            'utf8'
        );
        console.log(`Saved all task details to ${outputFile}`);
    } catch (err) {
        console.error('Error:', err.message);
    }
})();