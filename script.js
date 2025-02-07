// Inisialisasi peta
const map = L.map('map').setView([-7.790010760397501, 110.3749157771504], 10);

// Inisialisasi basemaps
const baseMaps = {
  OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
  }),
  'Google Terrain': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      attribution: 'Map data &copy; <a href="https://www.google.com/maps">Google Maps</a>',
  }),
  'Google Satellite': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Map data &copy; <a href="https://www.google.com/maps">Google Maps</a>',
  }),
  'googlestreetview': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: 'Map data &copy; <a href="https://www.google.com/maps">Google Maps</a>',
  }),
  'esri-world-imagery': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    }),
};

// Fungsi untuk mengganti basemap
function changeBasemap(basemapName) {
  map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
          map.removeLayer(layer);
      }
  });
  baseMaps[basemapName].addTo(map);
}

// Event listener untuk pilihan basemap
document.querySelectorAll('.basemap-filter input[name="basemap"]').forEach(input => {
  input.addEventListener('change', function () {
      const selectedBasemap = this.id; // Ambil ID dari radio button yang dipilih
      changeBasemap(selectedBasemap);
  });
});

// Tambahkan basemap default saat halaman dimuat
baseMaps.googlestreetview.addTo(map);

// Konfigurasi path ke folder KML
const KML_CONFIG = {
  basePath: 'Data/Lokasi/',
  locations: ['Blawong', 'Brongkol', 'Cokrobedog', 'Glendongan', 'Kanoman', 'Madean', 'Mergangsan', 'Mrican', 'Nologaten', 'Payaman', 'Pendowo', 'Pijenan', 'Ponggok', 'Pulodadi', 'Sapon', 'Sembuh', 'Sidomulyo', 'Simo', 'Tanjung', 'Tirtorejo', 'Trini'
  ],
  categories: ['Bangunan', 'Saluran', 'Fungsional'],
};

// Objek untuk menyimpan layer grup berdasarkan lokasi dan kategori
const layerGroups = {};
// Objek untuk menyimpan layer grup secara global per kategori (opsional, jika diperlukan)
const categoryLayers = {};

// Mapping dari id checkbox (huruf kecil) ke nama kategori (huruf kapital sesuai konfigurasi)
const legendMapping = {
  bangunan: 'Bangunan',
  saluran: 'Saluran',
  fungsional: 'Fungsional'
};

// Fungsi untuk memuat file KML individual
async function loadKMLFile(location, category, fileName) {
  const filePath = `${KML_CONFIG.basePath}${location}/${category}/${fileName}`;
  try {
    console.log('Memuat file KML:', filePath);
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const kmlText = await response.text();

    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');

    // Pastikan library L.KML sudah disertakan (misalnya leaflet-omnivore atau leaflet-geojson-layer)
    return new L.KML(kmlDoc);
  } catch (error) {
    console.error(`Gagal memuat ${filePath}:`, error);
    return null;
  }
}

// Fungsi untuk memproses layer KML (menambahkan popup dengan styling)
function processKmlLayer(layer) {
  layer.on('click', (e) => {
    const props = e.layer.feature.properties;

    // Template HTML untuk popup
    const content = `
        <div class="custom-popup">
          <h4 class="popup-title">
            <i class="fas fa-map-marker-alt"></i> ${props.name || 'Tanpa Nama'}
          </h4>
          <hr>
          <p class="popup-description">${props.description || 'Tidak ada deskripsi'}</p>
        </div>
        <button class="popup-nav-btn" onclick="navigateTo(${lat}, ${lng})">
          <i class="fas fa-directions"></i> Arahkan ke Lokasi
        </button>
      `;

    // Bind popup dengan tampilan baru
    e.layer.bindPopup(content, { maxWidth: 400 }).openPopup();
  });
  return layer;
}


// Fungsi untuk mendapatkan daftar file KML dari folder
async function fetchFolderFiles(folderPath) {
  try {
    const response = await fetch(folderPath);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Ambil hanya nama file (tanpa path tambahan)
    const links = Array.from(doc.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href').split('/').pop())
      .filter(file => file.endsWith('.kml'));
    return links;
  } catch (error) {
    console.error(`Gagal membaca folder ${folderPath}:`, error);
    return [];
  }
}

// Fungsi utama untuk memuat semua KML
async function loadAllKML() {
  try {
    let allLayers = [];

    // Iterasi setiap lokasi
    for (const location of KML_CONFIG.locations) {
      layerGroups[location] = {};

      // Iterasi setiap kategori
      for (const category of KML_CONFIG.categories) {
        const folderPath = `${KML_CONFIG.basePath}${location}/${category}/`;
        const files = await fetchFolderFiles(folderPath);
        if (!files.length) {
          console.warn(`Tidak ditemukan file KML di ${folderPath}`);
          continue;
        }

        const results = await Promise.allSettled(
          files.map(file => loadKMLFile(location, category, file))
        );

        const validLayers = results
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => processKmlLayer(result.value));

        // Buat layer group untuk lokasi dan kategori
        layerGroups[location][category] = L.layerGroup(validLayers);

        // (Opsional) Simpan ke kategori global jika diperlukan
        if (!categoryLayers[category]) {
          categoryLayers[category] = [];
        }
        categoryLayers[category].push(layerGroups[location][category]);

        allLayers.push(...validLayers);
      }
    }

    if (allLayers.length > 0) {
      const featureGroup = L.featureGroup(allLayers);
      map.fitBounds(featureGroup.getBounds());
    }

    setupLocationControls();
    setupLegendControls();
  } catch (error) {
    console.error('Error utama:', error);
    alert('Gagal memuat data peta!');
  }
}

// Variabel global untuk menyimpan lokasi aktif (default "Semua")
let activeLocation = 'Semua';

// Fungsi untuk mengatur kontrol lokasi (tombol kategori)
function setupLocationControls() {
  const locationButtons = document.querySelectorAll('.category-btn');

  locationButtons.forEach(button => {
    button.addEventListener('click', () => {
      const locationName = button.textContent.trim();
      activeLocation = locationName; // Update lokasi aktif

      // Nonaktifkan semua tombol
      locationButtons.forEach(btn => btn.classList.remove('active'));
      // Aktifkan tombol yang dipilih
      button.classList.add('active');

      // Hapus semua layer grup dari peta
      Object.values(layerGroups).forEach(locationGroup => {
        Object.values(locationGroup).forEach(group => group.removeFrom(map));
      });

      // Tampilkan layer sesuai dengan lokasi aktif dan status checkbox legenda
      if (activeLocation === 'Semua') {
        // Jika "Semua" dipilih, tampilkan layer dari semua lokasi
        Object.entries(layerGroups).forEach(([loc, groups]) => {
          Object.entries(groups).forEach(([cat, group]) => {
            // Periksa status checkbox legenda (gunakan id dengan huruf kecil)
            const checkbox = document.getElementById(cat.toLowerCase());
            if (checkbox && checkbox.checked) {
              group.addTo(map);
            }
          });
        });
      } else {
        // Tampilkan hanya layer dari lokasi yang dipilih
        if (layerGroups[activeLocation]) {
          Object.entries(layerGroups[activeLocation]).forEach(([cat, group]) => {
            const checkbox = document.getElementById(cat.toLowerCase());
            if (checkbox && checkbox.checked) {
              group.addTo(map);
            }
          });
        }
      }
    });
  });

  // Aktifkan tombol "Semua" secara default jika ada
  const allButton = document.querySelector('.category-btn.active');
  if (allButton) allButton.click();
}

// Fungsi untuk mengatur kontrol Legenda (checkbox)
function setupLegendControls() {
  const legendCheckboxes = document.querySelectorAll('.filter-check');

  legendCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      // Mapping id checkbox ke nama kategori yang sesuai
      const categoryKey = legendMapping[checkbox.id];
      
      // Tentukan lokasi aktif saat ini
      if (activeLocation === 'Semua') {
        // Jika "Semua" aktif, update semua layer untuk kategori ini
        if (categoryLayers[categoryKey]) {
          categoryLayers[categoryKey].forEach(group => {
            if (checkbox.checked) {
              group.addTo(map);
            } else {
              group.removeFrom(map);
            }
          });
        }
      } else {
        // Jika hanya satu lokasi aktif, update layer grup dari lokasi tersebut
        if (layerGroups[activeLocation] && layerGroups[activeLocation][categoryKey]) {
          if (checkbox.checked) {
            layerGroups[activeLocation][categoryKey].addTo(map);
          } else {
            layerGroups[activeLocation][categoryKey].removeFrom(map);
          }
        }
      }
    });
  });
}

// Responsive design: perbarui ukuran peta saat jendela berubah
window.addEventListener('resize', () => {
  map.invalidateSize();
});

// Eksekusi pemuatan KML
loadAllKML();

/* ----- Bagian Tambahan: Sidebar Responsif ----- */
// Seleksi sidebar dan tombol toggle floating yang baru
const sidebar = document.querySelector('.sidebar');
const floatingSidebarToggle = document.getElementById('floatingSidebarToggle');

// Fungsi toggle sidebar
function toggleSidebar() {
  sidebar.classList.toggle('active');
}

// Tambahkan event listener pada tombol toggle
floatingSidebarToggle.addEventListener('click', function(e) {
  e.stopPropagation(); // Mencegah event bubbling ke peta
  toggleSidebar();
});

// Tutup sidebar saat area peta diklik (jika sidebar terbuka)
map.on('click', function() {
  if (sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  }
});
/* ------------------------------------------------- */

// Update CSS variable untuk navbar height
document.documentElement.style.setProperty('--navbar-height', 
    document.querySelector('.navbar').offsetHeight + 'px'
);
function updateLayout() {
  const navbar = document.querySelector('.navbar');
  document.documentElement.style.setProperty('--navbar-height', navbar.offsetHeight + 'px');
  map.invalidateSize();
}
const navbarObserver = new ResizeObserver(() => updateLayout());
navbarObserver.observe(document.querySelector('.navbar'));

// Handle event Bootstrap untuk navbar (jika diperlukan)
document.addEventListener('DOMContentLoaded', () => {
  const navbarCollapse = document.getElementById('navbarNav');
  navbarCollapse.addEventListener('show.bs.collapse', () => {
    document.querySelector('.navbar').classList.add('transitioning');
  });
  navbarCollapse.addEventListener('shown.bs.collapse', () => {
    document.querySelector('.navbar').classList.remove('transitioning');
  });
  navbarCollapse.addEventListener('hide.bs.collapse', () => {
    document.querySelector('.navbar').classList.add('transitioning');
  });
  navbarCollapse.addEventListener('hidden.bs.collapse', () => {
    document.querySelector('.navbar').classList.remove('transitioning');
  });
});
