// --------------------------------------------------
// Fetches task summaries and full details from the soaring.siglr.com API
// and saves them to a local JSON file for offline or test use.
// 
// Usage: node fetch_tasks_to_json.js
// --------------------------------------------------

const fs = require('fs');
const http = require('http');

// Number of tasks to fetch (set to 0 to fetch all available tasks)
const numberOfTasks = 30;

const outputFile = 'test_tasks.json';

// API endpoint for fetching the list of tasks (summaries)
const listUrl = `http://soaring.siglr.com/php/GetTasksForMap.php?`;
const detailUrl = `http://soaring.siglr.com/php/GetTaskDetails.php?`;



/**
 * Helper function to perform an HTTP GET request and return the response as a string.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} - The response data.
 */

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
    // Remove the output file if it already exists to avoid appending to old data
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

    try {
        // Fetch the list of task summaries from the API
        const listData = await httpGet(listUrl);
        let json = JSON.parse(listData);

        // If a limit is set, slice the tasks array to the desired number
        if (Array.isArray(json.tasks) && numberOfTasks > 0) {
            json.tasks = json.tasks.slice(0, numberOfTasks);
            json.totalTasks = json.tasks.length;
        }

        // For each task summary, fetch the full task details and replace the summary with the details
        for (let i = 0; i < json.tasks.length; i++) {
            const entrySeqID = json.tasks[i].EntrySeqID;
            const entryDetailUrl = detailUrl + `entrySeqID=${entrySeqID}`;

            try {
                const detailData = await httpGet(entryDetailUrl);
                let detailJson = JSON.parse(detailData);

                // Ensure IGCRecordCount appears before IGCRecords in the output
                if (Array.isArray(detailJson.IGCRecords)) {
                    const igcCount = detailJson.IGCRecords.length;
                    // Remove both if present to control order
                    delete detailJson.IGCRecordCount;
                    const igcRecords = detailJson.IGCRecords;
                    delete detailJson.IGCRecords;
                    // Insert IGCRecordCount, then IGCRecords
                    detailJson.IGCRecordCount = igcCount;
                    detailJson.IGCRecords = igcRecords;
                } else {
                    detailJson.IGCRecordCount = 0;
                }

                json.tasks[i] = detailJson;
                console.log(`Fetched details for EntrySeqID ${entrySeqID}`);
            } catch (err) {
                console.error(`Error fetching details for EntrySeqID ${entrySeqID}:`, err.message);
            }
        }

        // Write the final array of detailed tasks to the output file
        fs.writeFileSync(outputFile, JSON.stringify(json, null, 3), 'utf8');
        console.log(`Saved detailed API response (${json.tasks.length} tasks) to ${outputFile}`);
    } catch (err) {
        console.error('Error:', err.message);
    }
})();