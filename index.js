const fs = require('fs');
const axios = require('axios');
const ical = require('ical.js');
const cliProgress = require('cli-progress');
const colors = require('colors'); // Thêm màu sắc cho terminal

// Lấy URL từ tham số dòng lệnh
const url = process.argv[2];

if (!url) {
    console.error(colors.red('❌ Vui lòng nhập URL của file .ics!'));
    process.exit(1);
}

// Hàm tải file ICS từ URL với thanh tiến trình màu xanh
async function downloadICS(url) {
    return new Promise(async (resolve, reject) => { // Bọc toàn bộ bằng Promise
        try {
            console.log(colors.cyan(`📥 Đang tải file từ: ${url}`));

            // Tạo thanh tiến trình màu xanh lá
            const progressBar = new cliProgress.SingleBar({
                format: colors.green('➡ {bar}') + ' {percentage}% | {value}/{total} KB',
                barCompleteChar: '█',
                barIncompleteChar: '░',
                hideCursor: true
            });

            // Bắt đầu tải file
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });

            // Lấy kích thước file (nếu có)
            const totalLength = response.headers['content-length'] || 1000000; // Mặc định 1MB nếu không có thông tin

            // Bắt đầu thanh tiến trình
            progressBar.start(Math.round(totalLength / 1024), 0);

            let downloadedLength = 0;
            let rawData = '';

            response.data.on('data', chunk => {
                downloadedLength += chunk.length;
                rawData += chunk.toString();
                progressBar.update(Math.round(downloadedLength / 1024));
            });

            response.data.on('end', () => {
                progressBar.stop();
                console.log(colors.green('✅ Tải file thành công!'));
                resolve(rawData); // ✅ Gọi resolve() bên trong Promise
            });

            response.data.on('error', err => {
                progressBar.stop();
                console.error(colors.red('❌ Lỗi khi tải file:', err.message));
                reject(err); // ✅ Gọi reject() nếu có lỗi
            });
        } catch (error) {
            console.error(colors.red('❌ Lỗi khi tải file:', error.message));
            reject(error); // ✅ Bắt lỗi và reject Promise
        }
    });
}

// Hàm xử lý file ICS
function filterICS(data) {
    const jcalData = ical.parse(data);
    const comp = new ical.Component(jcalData);
    const events = comp.getAllSubcomponents('vevent');

    // Lọc các sự kiện có ký hiệu [T] và rơi vào Chủ Nhật
    const filteredEvents = events.filter(event => {
        const summary = event.getFirstPropertyValue('summary') || '';
        const dtstart = event.getFirstPropertyValue('dtstart');

        const isImportant = summary.includes('[T]');
        const eventDate = new Date(dtstart.toString());
        const isSunday = eventDate.getUTCDay() === 0;

        return isImportant || isSunday;
    });

    // Tạo file ICS mới
    const newComp = new ical.Component(['vcalendar', [], []]);
    filteredEvents.forEach(event => newComp.addSubcomponent(event));

    return newComp.toString();
}

// Chạy chương trình
(async () => {
    try {
        const icsData = await downloadICS(url);
        const filteredData = filterICS(icsData);

        // Lưu file mới
        fs.writeFileSync('filtered-events.ics', filteredData);
        console.log(colors.green('🎉 File "filtered-events.ics" đã được tạo thành công!'));
    } catch (error) {
        console.error(colors.red('❌ Lỗi: ' + error.message));
    }
})();
