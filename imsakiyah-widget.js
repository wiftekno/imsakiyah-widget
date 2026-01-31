// Widget Jadwal Imsakiyah
function initImsakiyahWidget(container) {
    // API Endpoints untuk Imsakiyah
    const API_BASE_URL = "https://equran.id/api/v2/imsakiyah";
    
    // State management
    let currentProvince = '';
    let currentCity = '';
    let provinces = [];
    let citiesCache = {};
    let currentSchedule = null;
    
    // Buat struktur HTML widget
    const widgetHTML = `
        <div class="imsakiyah-widget" id="imsakiyahWidget">
            <!-- HEADER -->
            <div class="widget-header">
                <div class="arabic-calligraphy">رمضان</div>
                <div class="moon-decoration left">
                    <i class="fas fa-star-and-crescent"></i>
                </div>
                <div class="moon-decoration right">
                    <i class="fas fa-star-and-crescent"></i>
                </div>
                <div class="header-stars">
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                </div>
                <div class="header-content">
                    <div class="pdf-title">Jadwal Imsakiyah Ramadhan</div>
                    <div class="pdf-subtitle">Bulan Suci Penuh Berkah</div>
                    <div class="pdf-location" id="headerLocation">
                        <i class="fas fa-map-marker-alt"></i>
                        <span id="currentLocationText">Pilih lokasi untuk menampilkan jadwal</span>
                    </div>
                    <div class="pdf-year" id="yearDisplay">1447 H / 2026 M</div>
                </div>
            </div>
            
            <!-- FORM PEMILIHAN LOKASI -->
            <div class="location-form" id="locationForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="provinceSelect">Pilih Provinsi</label>
                        <select class="form-select" id="provinceSelect">
                            <option value="">Memuat provinsi...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="citySelect">Pilih Kabupaten/Kota</label>
                        <select class="form-select" id="citySelect" disabled>
                            <option value="">Pilih provinsi terlebih dahulu</option>
                        </select>
                    </div>
                    <div class="download-btn-container">
                        <label for="downloadPDF">Unduh Jadwal</label>
                        <button class="btn-download" id="downloadPDF" disabled>
                            <i class="fas fa-download"></i> Download PDF
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- CONTAINER UNTUK JADWAL -->
            <div id="scheduleContainer">
                <div class="empty-state">
                    <i class="fas fa-calendar-alt" style="font-size: 2rem; margin-bottom: 10px; color: var(--js-border);"></i>
                    <p>Pilih lokasi untuk menampilkan jadwal imsakiyah Ramadhan</p>
                </div>
            </div>
            
            <!-- FOOTER -->
            <div class="data-source">
                Sumber: <a href="https://bimasislam.kemenag.go.id" target="_blank">bimasislam.kemenag.go.id</a> | <a href="https://wiftek.com" target="_blank">wiftek.com</a>
            </div>
        </div>
    `;
    
    // Masukkan widget ke dalam container
    container.innerHTML = widgetHTML;
    
    // Dapatkan elemen DOM
    const provinceSelect = container.querySelector('#provinceSelect');
    const citySelect = container.querySelector('#citySelect');
    const downloadPDFBtn = container.querySelector('#downloadPDF');
    const scheduleContainer = container.querySelector('#scheduleContainer');
    const yearDisplay = container.querySelector('#yearDisplay');
    const currentLocationText = container.querySelector('#currentLocationText');
    
    // Fungsi untuk memuat daftar provinsi
    async function loadProvinces() {
        try {
            const response = await fetch(`${API_BASE_URL}/provinsi`);
            const data = await response.json();
            
            if (data.code === 200) {
                provinces = data.data;
                provinceSelect.innerHTML = '<option value="">Pilih Provinsi</option>';
                
                provinces.sort().forEach(province => {
                    const option = document.createElement('option');
                    option.value = province;
                    option.textContent = province;
                    provinceSelect.appendChild(option);
                });
                
                return provinces;
            } else {
                throw new Error(data.message || 'Gagal memuat provinsi');
            }
        } catch (error) {
            console.error('Error loading provinces:', error);
            provinceSelect.innerHTML = '<option value="">Gagal memuat provinsi</option>';
            return [];
        }
    }
    
    // Fungsi untuk memuat kota berdasarkan provinsi
    async function loadCities(province) {
        if (!province) return [];
        
        if (citiesCache[province]) {
            return citiesCache[province];
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/kabkota`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ provinsi: province })
            });
            
            const data = await response.json();
            
            if (data.code === 200) {
                citiesCache[province] = data.data;
                return data.data;
            } else {
                throw new Error(data.message || 'Gagal memuat kota');
            }
        } catch (error) {
            console.error('Error loading cities:', error);
            return [];
        }
    }
    
    // Fungsi untuk memperbarui dropdown kota
    async function updateCityDropdown(province) {
        if (!province) {
            citySelect.innerHTML = '<option value="">Pilih provinsi terlebih dahulu</option>';
            citySelect.disabled = true;
            return;
        }
        
        citySelect.disabled = true;
        citySelect.innerHTML = '<option value="">Memuat kabupaten/kota...</option>';
        
        const cities = await loadCities(province);
        
        if (cities.length > 0) {
            citySelect.innerHTML = '<option value="">Pilih Kabupaten/Kota</option>';
            
            cities.sort().forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                citySelect.appendChild(option);
            });
            
            citySelect.disabled = false;
        } else {
            citySelect.innerHTML = '<option value="">Gagal memuat kabupaten/kota</option>';
        }
    }
    
    // Fungsi untuk update lokasi di header
    function updateHeaderLocation(city, province) {
        if (city && province) {
            currentLocationText.textContent = `${city}, ${province}`;
        } else if (city) {
            currentLocationText.textContent = `${city}`;
        } else {
            currentLocationText.textContent = 'Pilih lokasi untuk menampilkan jadwal';
        }
    }
    
    // Fungsi untuk memuat jadwal imsakiyah
    async function loadSchedule(province, city) {
        if (!province || !city) {
            showError('Silakan pilih provinsi dan kota terlebih dahulu');
            return;
        }
        
        try {
            scheduleContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Memuat jadwal imsakiyah...</p>
                </div>
            `;
            
            const response = await fetch(`${API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    provinsi: province,
                    kabkota: city
                })
            });
            
            const data = await response.json();
            
            if (data.code === 200) {
                currentSchedule = data.data;
                displaySchedule(data.data);
                
                downloadPDFBtn.disabled = false;
                updateHeaderLocation(city, province);
                
                if (data.data.hijriah && data.data.masehi) {
                    yearDisplay.textContent = `${data.data.hijriah} H / ${data.data.masehi} M`;
                }
            } else {
                throw new Error(data.message || 'Gagal memuat jadwal');
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
            showError(`Gagal memuat jadwal: ${error.message}`);
            downloadPDFBtn.disabled = true;
        }
    }
    
    // Fungsi untuk menampilkan jadwal
    function displaySchedule(scheduleData) {
        const { provinsi, kabkota, hijriah, masehi, imsakiyah } = scheduleData;
        const today = new Date().getDate();
        
        let tableHTML = '';
        imsakiyah.forEach(day => {
            const isToday = day.tanggal === today;
            tableHTML += `
                <tr class="${isToday ? 'today-row' : ''}">
                    <td>${day.tanggal}</td>
                    <td>${day.imsak}</td>
                    <td>${day.subuh}</td>
                    <td>${day.dzuhur}</td>
                    <td>${day.ashar}</td>
                    <td>${day.maghrib}</td>
                    <td>${day.isya}</td>
                </tr>
            `;
        });
        
        scheduleContainer.innerHTML = `
            <div class="current-location">
                <i class="fas fa-map-marker-alt"></i> ${kabkota}, ${provinsi}
            </div>
            <div class="table-container">
                <table class="imsakiyah-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>Imsak</th>
                            <th>Subuh</th>
                            <th>Dzuhur</th>
                            <th>Ashar</th>
                            <th>Maghrib</th>
                            <th>Isya</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableHTML}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Fungsi untuk menampilkan error
    function showError(message) {
        scheduleContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--js-danger); margin-bottom: 10px;"></i>
                <p>${message}</p>
            </div>
        `;
    }
    
    // Fungsi untuk download PDF (dioptimalkan untuk satu halaman)
    function downloadPDF() {
        if (!currentSchedule) return;
        
        const pdfWindow = window.open('', '_blank');
        
        pdfWindow.document.write(`
            <html>
                <head>
                    <title>Jadwal Imsakiyah ${currentSchedule.kabkota}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                        
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        @page {
                            size: A4 portrait;
                            margin: 0.5cm;
                        }
                        
                        @media print {
                            body {
                                width: 100% !important;
                                height: 100% !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                font-size: 11px !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                        
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                            line-height: 1.3;
                            color: #212529;
                            padding: 0;
                            background: white;
                            font-size: 11px;
                            width: 210mm;
                            height: 297mm;
                            margin: 0 auto;
                        }
                        
                        .pdf-header {
                            background: linear-gradient(135deg, #0a5c36 0%, #1db954 100%);
                            color: white;
                            text-align: center;
                            padding: 15px 10px;
                            position: relative;
                            overflow: hidden;
                            border-bottom: 3px solid #ffd43b;
                            min-height: 120px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        .arabic-calligraphy {
                            position: absolute;
                            top: 5px;
                            left: 50%;
                            transform: translateX(-50%);
                            font-size: 2.2rem;
                            font-family: 'Traditional Arabic', 'Scheherazade', serif;
                            color: rgba(255, 255, 255, 0.08);
                            z-index: 1;
                            font-weight: bold;
                        }
                        
                        .pdf-header-content {
                            position: relative;
                            z-index: 2;
                        }
                        
                        .pdf-title {
                            font-size: 20px;
                            font-weight: 900;
                            margin-bottom: 5px;
                            letter-spacing: 0.3px;
                        }
                        
                        .pdf-subtitle {
                            font-size: 14px;
                            font-weight: 600;
                            letter-spacing: 0.5px;
                            margin-bottom: 8px;
                            color: #c5f0d1;
                        }
                        
                        .pdf-location {
                            font-size: 15px;
                            font-weight: 700;
                            margin: 10px 0 6px 0;
                            padding: 6px 12px;
                            background: rgba(0, 0, 0, 0.2);
                            display: inline-block;
                            border-radius: 15px;
                            border: 1px solid rgba(255, 215, 0, 0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                        }
                        
                        .pdf-year {
                            font-size: 12px;
                            font-weight: 500;
                            background: rgba(0, 0, 0, 0.3);
                            padding: 4px 10px;
                            border-radius: 12px;
                            display: inline-block;
                            margin-top: 3px;
                            border: 1px solid rgba(255, 215, 0, 0.3);
                        }
                        
                        .moon-decoration {
                            position: absolute;
                            z-index: 1;
                            font-size: 2rem;
                            color: rgba(255, 215, 0, 0.6);
                        }
                        
                        .moon-decoration.left {
                            left: 15px;
                            top: 50%;
                            transform: translateY(-50%) rotate(-15deg);
                        }
                        
                        .moon-decoration.right {
                            right: 15px;
                            top: 50%;
                            transform: translateY(-50%) rotate(15deg);
                        }
                        
                        .header-stars {
                            position: absolute;
                            top: 15px;
                            right: 50px;
                            display: flex;
                            gap: 6px;
                            z-index: 1;
                        }
                        
                        .header-stars i {
                            font-size: 0.7rem;
                            color: #ffd43b;
                        }
                        
                        .pdf-container {
                            width: 100%;
                            padding: 10px;
                            margin: 0 auto;
                        }
                        
                        .pdf-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 10px;
                            margin-top: 10px;
                            table-layout: fixed;
                        }
                        
                        .pdf-table thead {
                            background: linear-gradient(135deg, #0a5c36 0%, #1db954 100%);
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        .pdf-table th {
                            color: white;
                            padding: 8px 3px;
                            text-align: center;
                            font-weight: 700;
                            font-size: 10px;
                            border: none;
                            white-space: nowrap;
                        }
                        
                        .pdf-table tbody tr {
                            border-bottom: 1px solid #dee2e6;
                            height: 24px;
                        }
                        
                        .pdf-table tbody tr:nth-child(even) {
                            background-color: #f8f9fa;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        .pdf-table td {
                            padding: 6px 3px;
                            text-align: center;
                            border: none;
                            font-weight: 500;
                            font-size: 10px;
                            line-height: 1.2;
                        }
                        
                        .pdf-table td:first-child {
                            font-weight: 700;
                            background-color: #f1f3f5;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            width: 8%;
                        }
                        
                        .pdf-table th:nth-child(1),
                        .pdf-table td:nth-child(1) { width: 8%; }
                        .pdf-table th:nth-child(2),
                        .pdf-table td:nth-child(2) { width: 10%; }
                        .pdf-table th:nth-child(3),
                        .pdf-table td:nth-child(3) { width: 10%; }
                        .pdf-table th:nth-child(4),
                        .pdf-table td:nth-child(4) { width: 10%; }
                        .pdf-table th:nth-child(5),
                        .pdf-table td:nth-child(5) { width: 10%; }
                        .pdf-table th:nth-child(6),
                        .pdf-table td:nth-child(6) { width: 10%; }
                        .pdf-table th:nth-child(7),
                        .pdf-table td:nth-child(7) { width: 10%; }
                        .pdf-table th:nth-child(8),
                        .pdf-table td:nth-child(8) { width: 10%; }
                        .pdf-table th:nth-child(9),
                        .pdf-table td:nth-child(9) { width: 12%; }
                        
                        .imsak-magrib {
                            color: #e74c3c !important;
                            font-weight: 700 !important;
                        }
                        
                        .today-pdf {
                            background-color: #e3f2fd !important;
                            border-left: 3px solid #1a5fb4;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        .pdf-footer {
                            text-align: center;
                            margin-top: 15px;
                            padding-top: 10px;
                            border-top: 1px solid #dee2e6;
                            color: #6c757d;
                            font-size: 9px;
                        }
                        
                        .pdf-footer a {
                            color: #1a5fb4;
                            text-decoration: none;
                            font-weight: 600;
                        }
                    </style>
                </head>
                <body>
                    <div class="pdf-header">
                        <div class="arabic-calligraphy">رمضان</div>
                        <div class="moon-decoration left">
                            <i class="fas fa-star-and-crescent"></i>
                        </div>
                        <div class="moon-decoration right">
                            <i class="fas fa-star-and-crescent"></i>
                        </div>
                        <div class="header-stars">
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="pdf-header-content">
                            <div class="pdf-title">Jadwal Imsakiyah Ramadhan</div>
                            <div class="pdf-subtitle">Bulan Suci Penuh Berkah</div>
                            <div class="pdf-location">
                                <i class="fas fa-map-marker-alt"></i>
                                ${currentSchedule.kabkota}, ${currentSchedule.provinsi}
                            </div>
                            <div class="pdf-year">${currentSchedule.hijriah} H / ${currentSchedule.masehi} M</div>
                        </div>
                    </div>
                    
                    <div class="pdf-container">
                        <table class="pdf-table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Imsak</th>
                                    <th>Subuh</th>
                                    <th>Terbit</th>
                                    <th>Dhuha</th>
                                    <th>Dzuhur</th>
                                    <th>Ashar</th>
                                    <th>Maghrib</th>
                                    <th>Isya</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${currentSchedule.imsakiyah.map(day => {
                                    const isToday = day.tanggal === new Date().getDate();
                                    return `
                                        <tr class="${isToday ? 'today-pdf' : ''}">
                                            <td>${day.tanggal}</td>
                                            <td class="imsak-magrib">${day.imsak}</td>
                                            <td>${day.subuh}</td>
                                            <td>${day.terbit}</td>
                                            <td>${day.dhuha}</td>
                                            <td>${day.dzuhur}</td>
                                            <td>${day.ashar}</td>
                                            <td class="imsak-magrib">${day.maghrib}</td>
                                            <td>${day.isya}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        
                        <div class="pdf-footer">
                            Sumber: <a href="https://bimasislam.kemenag.go.id" target="_blank">bimasislam.kemenag.go.id</a> | 
                            <a href="https://wiftek.com" target="_blank">wiftek.com</a><br>
                            Dicetak pada ${new Date().toLocaleString('id-ID', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                    
                    <script>
                        const faLink = document.createElement('link');
                        faLink.rel = 'stylesheet';
                        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
                        document.head.appendChild(faLink);
                        
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    <\/script>
                </body>
            </html>
        `);
        pdfWindow.document.close();
        
        const originalText = downloadPDFBtn.innerHTML;
        const originalBg = downloadPDFBtn.style.background;
        downloadPDFBtn.innerHTML = '<i class="fas fa-check"></i> Terunduh';
        downloadPDFBtn.style.background = '#28a745';
        
        setTimeout(() => {
            downloadPDFBtn.innerHTML = originalText;
            downloadPDFBtn.style.background = originalBg;
        }, 2000);
    }
    
    // Event Listeners
    provinceSelect.addEventListener('change', async function() {
        currentProvince = this.value;
        await updateCityDropdown(currentProvince);
        currentCity = '';
        downloadPDFBtn.disabled = true;
        
        updateHeaderLocation(currentProvince, '');
        
        scheduleContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-alt" style="font-size: 2rem; margin-bottom: 10px; color: var(--js-border);"></i>
                <p>Pilih kota untuk menampilkan jadwal imsakiyah Ramadhan</p>
            </div>
        `;
    });
    
    citySelect.addEventListener('change', function() {
        currentCity = this.value;
        if (currentProvince && currentCity) {
            loadSchedule(currentProvince, currentCity);
        } else {
            downloadPDFBtn.disabled = true;
        }
    });
    
    downloadPDFBtn.addEventListener('click', downloadPDF);
    
    // Inisialisasi
    async function initializeWidget() {
        await loadProvinces();
        updateHeaderLocation('', '');
    }
    
    // Jalankan inisialisasi
    initializeWidget();
}

// Buat fungsi global agar bisa diakses dari luar
window.initImsakiyahWidget = initImsakiyahWidget;
