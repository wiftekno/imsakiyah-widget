        // API Endpoints untuk Imsakiyah
        const API_BASE_URL = "https://equran.id/api/v2/imsakiyah";
        
        // State management
        let currentProvince = '';
        let currentCity = '';
        let provinces = [];
        let citiesCache = {};
        let currentSchedule = null;
        
        // DOM Elements
        const detectionNotice = document.getElementById('detectionNotice');
        const detectionStatus = document.getElementById('detectionStatus');
        const detectLocationBtn = document.getElementById('detectLocation');
        const provinceSelect = document.getElementById('provinceSelect');
        const citySelect = document.getElementById('citySelect');
        const downloadPDFBtn = document.getElementById('downloadPDF');
        const scheduleContainer = document.getElementById('scheduleContainer');
        const yearDisplay = document.getElementById('yearDisplay');
        const currentLocationText = document.getElementById('currentLocationText');
        const headerLocation = document.getElementById('headerLocation');
        
        // Fungsi untuk mendapatkan lokasi pengguna
        async function getUserLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation tidak didukung oleh browser Anda'));
                    return;
                }
                
                navigator.geolocation.getCurrentPosition(
                    position => resolve(position.coords),
                    error => reject(error),
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            });
        }
        
        // Fungsi untuk reverse geocoding (mendapatkan nama lokasi dari koordinat)
        async function reverseGeocode(lat, lon) {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`,
                    {
                        headers: {
                            'User-Agent': 'ImsakiyahWidget/1.0'
                        }
                    }
                );
                
                if (!response.ok) throw new Error('Gagal mendapatkan data lokasi');
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Reverse geocode error:', error);
                throw error;
            }
        }
        
        // Fungsi untuk memuat daftar provinsi
        async function loadProvinces() {
            try {
                const response = await fetch(`${API_BASE_URL}/provinsi`);
                const data = await response.json();
                
                if (data.code === 200) {
                    provinces = data.data;
                    provinceSelect.innerHTML = '<option value="">Pilih Provinsi</option>';
                    
                    // Urutkan provinsi berdasarkan abjad
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
            
            // Cek cache dulu
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
        
        // Fungsi untuk mencari provinsi yang cocok dari nama lokasi
        function findMatchingProvince(locationName) {
            if (!locationName || !provinces.length) return null;
            
            const locationLower = locationName.toLowerCase();
            
            // Prioritas pencarian
            const searchPatterns = [
                (prov) => prov.toLowerCase() === locationLower,
                (prov) => prov.toLowerCase().includes(locationLower),
                (prov) => locationLower.includes(prov.toLowerCase()),
                (prov) => {
                    const cleanProv = prov.toLowerCase().replace(/[^a-z]/g, '');
                    const cleanLocation = locationLower.replace(/[^a-z]/g, '');
                    return cleanProv.includes(cleanLocation) || cleanLocation.includes(cleanProv);
                }
            ];
            
            for (const pattern of searchPatterns) {
                const match = provinces.find(pattern);
                if (match) return match;
            }
            
            return null;
        }
        
        // Fungsi untuk mencari kota yang cocok
        function findMatchingCity(cities, cityName) {
            if (!cityName || !cities.length) return null;
            
            const cityLower = cityName.toLowerCase();
            
            const searchPatterns = [
                (city) => city.toLowerCase() === cityLower,
                (city) => city.toLowerCase().includes(cityLower),
                (city) => cityLower.includes(city.toLowerCase()),
                (city) => {
                    const cleanCity = city.toLowerCase().replace(/[^a-z]/g, '');
                    const cleanName = cityLower.replace(/[^a-z]/g, '');
                    return cleanCity.includes(cleanName) || cleanName.includes(cleanCity);
                }
            ];
            
            for (const pattern of searchPatterns) {
                const match = cities.find(pattern);
                if (match) return match;
            }
            
            return null;
        }
        
        // Fungsi untuk mendeteksi lokasi otomatis
        async function detectLocation() {
            try {
                detectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendeteksi lokasi...';
                
                // Dapatkan koordinat
                const coords = await getUserLocation();
                
                // Reverse geocode untuk mendapatkan nama lokasi
                detectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendapatkan nama lokasi...';
                const locationData = await reverseGeocode(coords.latitude, coords.longitude);
                
                if (!locationData.address) {
                    throw new Error('Tidak dapat mendapatkan informasi lokasi');
                }
                
                const address = locationData.address;
                
                // Coba dapatkan provinsi dan kota dari data address
                let detectedProvince = address.state || address.province || address.region;
                let detectedCity = address.city || address.town || address.village || address.county;
                
                // Jika tidak ada, coba dari display_name
                if (!detectedProvince || !detectedCity) {
                    const parts = locationData.display_name.split(',');
                    if (parts.length >= 3) {
                        if (!detectedCity) detectedCity = parts[parts.length - 4]?.trim();
                        if (!detectedProvince) detectedProvince = parts[parts.length - 3]?.trim();
                    }
                }
                
                // Cari kecocokan dengan daftar provinsi
                if (detectedProvince) {
                    const matchedProvince = findMatchingProvince(detectedProvince);
                    
                    if (matchedProvince) {
                        currentProvince = matchedProvince;
                        
                        // Muat kota untuk provinsi ini
                        const cities = await loadCities(matchedProvince);
                        
                        if (cities.length > 0) {
                            // Cari kota yang cocok
                            if (detectedCity) {
                                const matchedCity = findMatchingCity(cities, detectedCity);
                                
                                if (matchedCity) {
                                    currentCity = matchedCity;
                                    detectionStatus.innerHTML = `<i class="fas fa-check-circle"></i> Lokasi terdeteksi: ${matchedCity}, ${matchedProvince}`;
                                    
                                    // Isi dropdown
                                    provinceSelect.value = matchedProvince;
                                    await updateCityDropdown(matchedProvince);
                                    citySelect.value = matchedCity;
                                    
                                    // Update lokasi di header
                                    updateHeaderLocation(matchedCity, matchedProvince);
                                    
                                    // Tampilkan jadwal
                                    setTimeout(() => {
                                        loadSchedule(currentProvince, currentCity);
                                    }, 1000);
                                    
                                    return;
                                }
                            }
                            
                            // Jika kota tidak ditemukan, isi hanya provinsi
                            detectionStatus.innerHTML = `<i class="fas fa-info-circle"></i> Provinsi terdeteksi: ${matchedProvince}. Silakan pilih kota.`;
                            
                            // Isi dropdown provinsi
                            provinceSelect.value = matchedProvince;
                            await updateCityDropdown(matchedProvince);
                            
                            // Update lokasi di header
                            updateHeaderLocation(matchedProvince, '');
                            
                            return;
                        }
                    }
                }
                
                // Jika tidak berhasil deteksi otomatis
                detectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Tidak dapat mendeteksi lokasi. Silakan pilih manual.';
                
            } catch (error) {
                console.error('Location detection error:', error);
                
                let errorMessage = 'Tidak dapat mendeteksi lokasi. Silakan pilih manual.';
                
                if (error.code === 1) {
                    errorMessage = 'Akses lokasi ditolak. Silakan pilih lokasi manual.';
                } else if (error.code === 2) {
                    errorMessage = 'Lokasi tidak tersedia. Silakan pilih lokasi manual.';
                } else if (error.code === 3) {
                    errorMessage = 'Waktu permintaan lokasi habis. Silakan pilih lokasi manual.';
                }
                
                detectionStatus.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errorMessage}`;
            }
        }
        
        // Fungsi untuk update lokasi di header
        function updateHeaderLocation(city, province) {
            if (city && province) {
                currentLocationText.textContent = `${city}, ${province}`;
                headerLocation.style.display = 'inline-flex';
            } else if (city) {
                currentLocationText.textContent = `${city}`;
                headerLocation.style.display = 'inline-flex';
            } else {
                currentLocationText.textContent = 'Pilih lokasi untuk menampilkan jadwal';
                headerLocation.style.display = 'inline-flex';
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
                
                // Urutkan kota berdasarkan abjad
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
        
        // Fungsi untuk memuat jadwal imsakiyah
        async function loadSchedule(province, city) {
            if (!province || !city) {
                showError('Silakan pilih provinsi dan kota terlebih dahulu');
                return;
            }
            
            try {
                // Tampilkan loading
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
                    
                    // Enable tombol download PDF
                    downloadPDFBtn.disabled = false;
                    
                    // Update status deteksi
                    detectionStatus.innerHTML = `<i class="fas fa-check-circle"></i> Menampilkan jadwal untuk ${city}, ${province}`;
                    
                    // Update lokasi di header
                    updateHeaderLocation(city, province);
                    
                    // Update tahun di header berdasarkan data
                    if (data.data.hijriah && data.data.masehi) {
                        yearDisplay.textContent = `${data.data.hijriah} H / ${data.data.masehi} M`;
                    }
                } else {
                    throw new Error(data.message || 'Gagal memuat jadwal');
                }
            } catch (error) {
                console.error('Error loading schedule:', error);
                showError(`Gagal memuat jadwal: ${error.message}`);
                
                // Disable tombol download PDF jika error
                downloadPDFBtn.disabled = true;
            }
        }
        
        // Fungsi untuk menampilkan jadwal (tanpa Terbit dan Dhuha)
        function displaySchedule(scheduleData) {
            const { provinsi, kabkota, hijriah, masehi, imsakiyah } = scheduleData;
            const today = new Date().getDate();
            
            // Buat HTML untuk tabel jadwal (tanpa Terbit dan Dhuha)
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
            
            // Gabungkan semua komponen
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
            if (!currentSchedule) {
                return;
            }
            
            // Langsung buka jendela baru tanpa alert
            const pdfWindow = window.open('', '_blank');
            
            // Hitung jumlah baris per halaman (optimasi untuk A4 portrait)
            const rowsPerPage = 25; // Disesuaikan agar muat dalam satu halaman
            const totalRows = currentSchedule.imsakiyah.length;
            const pages = Math.ceil(totalRows / rowsPerPage);
            
            // Buat konten PDF dengan header yang sama seperti widget
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
                            
                            /* ATURAN CETAK UNTUK SATU HALAMAN */
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
                                
                                .page {
                                    page-break-after: always;
                                    width: 100%;
                                    height: 100%;
                                }
                                
                                .page:last-child {
                                    page-break-after: avoid;
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
                            
                            /* Header PDF SAMA PERSIS DENGAN WIDGET */
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
                            
                            /* Gradien overlay untuk efek depth */
                            .pdf-header::before {
                                content: '';
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                                bottom: 0;
                                background: linear-gradient(45deg, 
                                    rgba(255, 215, 0, 0.15) 0%, 
                                    rgba(255, 215, 0, 0) 50%);
                                z-index: 0;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            
                            /* Pola Islami subtle */
                            .pdf-header::after {
                                content: '';
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                                bottom: 0;
                                background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                                opacity: 0.2;
                                z-index: 0;
                            }
                            
                            /* Kaligrafi Arab */
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
                                text-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
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
                                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
                            
                            /* Dekorasi bulan sabit */
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
                            
                            /* Bintang-bintang */
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
                            
                            /* Container utama */
                            .pdf-container {
                                width: 100%;
                                padding: 10px;
                                margin: 0 auto;
                            }
                            
                            /* Tabel PDF - DIOPTIMALKAN UNTUK SATU HALAMAN */
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
                                overflow: hidden;
                                text-overflow: ellipsis;
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
                            
                            /* Atur lebar kolom untuk mengoptimalkan ruang */
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
                            
                            /* Warna khusus untuk Imsak dan Magrib */
                            .imsak-magrib {
                                color: #e74c3c !important;
                                font-weight: 700 !important;
                            }
                            
                            /* Baris hari ini */
                            .today-pdf {
                                background-color: #e3f2fd !important;
                                border-left: 3px solid #1a5fb4;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            
                            /* Footer PDF */
                            .pdf-footer {
                                text-align: center;
                                margin-top: 15px;
                                padding-top: 10px;
                                border-top: 1px solid #dee2e6;
                                color: #6c757d;
                                font-size: 9px;
                                page-break-inside: avoid;
                            }
                            
                            .pdf-footer a {
                                color: #1a5fb4;
                                text-decoration: none;
                                font-weight: 600;
                            }
                            
                            /* Kompres padding dan margin */
                            .page {
                                padding: 5mm;
                                margin: 0;
                            }
                            
                            /* Hilangkan shadow untuk cetakan */
                            .pdf-table {
                                box-shadow: none !important;
                            }
                        </style>
                    </head>
                    <body>
                        <!-- Header PDF SAMA PERSIS DENGAN WIDGET -->
                        <div class="pdf-header">
                            
                            <!-- Dekorasi bulan sabit di kiri -->
                            <div class="moon-decoration left">
                                <i class="fas fa-star-and-crescent"></i>
                            </div>
                            
                            <!-- Dekorasi bulan sabit di kanan -->
                            <div class="moon-decoration right">
                                <i class="fas fa-star-and-crescent"></i>
                            </div>
                            
                            <!-- Bintang-bintang -->
                            <div class="header-stars">
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                                <i class="fas fa-star"></i>
                            </div>
                            
                            <!-- Konten utama -->
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
                        
                        <!-- Container utama -->
                        <div class="pdf-container">
                            <!-- Tabel PDF -->
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
                            
                            <!-- Footer PDF -->
                            <div class="pdf-footer">
                                Sumber: <a href="https://bimasislam.kemenag.go.id" target="_blank">bimasislam.kemenag.go.id</a> | 
                                <a href="https://www.wiftek.com" target="_blank">WIFTEK.COM</a><br>
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
                            // Tambahkan Font Awesome untuk ikon
                            const faLink = document.createElement('link');
                            faLink.rel = 'stylesheet';
                            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
                            document.head.appendChild(faLink);
                            
                            // Otomatis cetak setelah halaman dimuat
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
            
            // Beri feedback visual tanpa alert
            const originalText = downloadPDFBtn.innerHTML;
            const originalBg = downloadPDFBtn.style.background;
            downloadPDFBtn.innerHTML = '<i class="fas fa-check"></i> Terunduh';
            downloadPDFBtn.style.background = '#28a745';
            
            setTimeout(() => {
                downloadPDFBtn.innerHTML = originalText;
                downloadPDFBtn.style.background = originalBg;
            }, 2000);
        }
        
        // ==================== EVENT LISTENERS ====================
        
        detectLocationBtn.addEventListener('click', detectLocation);
        
        // Saat provinsi dipilih, update dropdown kota
        provinceSelect.addEventListener('change', async function() {
            currentProvince = this.value;
            await updateCityDropdown(currentProvince);
            currentCity = ''; // Reset kota saat provinsi berubah
            
            // Disable tombol download saat provinsi berubah
            downloadPDFBtn.disabled = true;
            
            // Update lokasi di header
            if (currentProvince) {
                updateHeaderLocation(currentProvince, '');
            } else {
                updateHeaderLocation('', '');
            }
            
            // Reset jadwal saat provinsi berubah
            scheduleContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-alt" style="font-size: 2rem; margin-bottom: 10px; color: var(--js-border);"></i>
                    <p>Pilih kota untuk menampilkan jadwal imsakiyah Ramadhan</p>
                </div>
            `;
        });
        
        // Saat kota dipilih, langsung tampilkan jadwal
        citySelect.addEventListener('change', function() {
            currentCity = this.value;
            
            // Jika kota sudah dipilih, langsung tampilkan jadwal
            if (currentProvince && currentCity) {
                loadSchedule(currentProvince, currentCity);
            } else {
                // Disable tombol download jika kota belum dipilih
                downloadPDFBtn.disabled = true;
            }
        });
        
        // Tombol download PDF
        downloadPDFBtn.addEventListener('click', downloadPDF);
        
        // ==================== INISIALISASI WIDGET ====================
        
        document.addEventListener('DOMContentLoaded', async function() {
            // Muat daftar provinsi terlebih dahulu
            await loadProvinces();
            
            // Coba deteksi lokasi otomatis
            setTimeout(() => {
                detectLocation();
            }, 500);
        });