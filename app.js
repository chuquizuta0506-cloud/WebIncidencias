import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ================= CONFIGURACIÓN DE FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyAPRmyN9muRimrvwfFLEhJowsdAMFm6LUk",
  authDomain: "incidencias-ramon-castilla.firebaseapp.com",
  projectId: "incidencias-ramon-castilla",
  storageBucket: "incidencias-ramon-castilla.firebasestorage.app",
  messagingSenderId: "1034379207173",
  appId: "1:1034379207173:web:006d2ac974265620de326c",
  measurementId: "G-6XHNWMD7ZC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= LISTAS DE APOYO =================
const GRADOS_SECCIONES = {
  PRIMERO: ["AUSBEL", "BRUNER", "EISTEIN"],
  SEGUNDO: ["MENDEKL", "PASTEUR", "VIGOTSKY"],
  TERCERO: ["ARGUEDAS", "FREIRE", "VALDELOMAR"],
  CUARTO: ["GARDNER", "MONTESORI", "PIAGET"],
  QUINTO: ["GALILEO", "NEWTON", "PAULET"]
};

const INCIDENCIAS_POR_GRAVEDAD = {
  LEVE: [
    "Uniforme/vestimenta",
    "Higiene/aseo",
    "Cabello",
    "Maquillaje/accesorios",
    "Tardanza",
    "Inasistencia",
    "Celular/dispositivo",
    "Falta de respeto",
    "Agresión física/verbal",
    "Daño de bienes",
    "Incumplimiento de norma"
  ],
  GRAVE: [
    "Daño A La Propiedad Escolar",
    "Reincidencia En Faltas Leves",
    "Uso Indebido De Celulares",
    "Tardanzas Reiteradas Injustificadas",
    "Agresión Física O Psicológica",
    "Posesión De Sustancias Prohibidas",
    "Justificativos Simples Adulterados",
    "Vulneración De La Intimidad O Dignidad",
    "Incitación A Retos O Conductas Peligrosas",
    "Atentar Contra La Imagen Institucional"
  ],
  "MUY GRAVE": [
    "Actos de odio o apología a la violencia",
    "Discriminación",
    "Acoso o violencia sexual",
    "Acoso escolar grave",
    "Alteración violenta del orden educativo",
    "Hurto o robo de bienes",
    "Destrucción o sabotaje de LA infraestructura ESCOLAR",
    "Extorsión o cobro de cupos",
    "Falsa denuncia o difamación al personal",
    "Falsificación de documentos oficiales",
    "Difusión no autorizada de datos privados",
    "Fraude académico o hackeo de evaluaciones",
    "Captación para pandillaje o apuestas",
    "Comercialización o promoción de sustancias prohibidas",
    "Porte o uso de armas u objetos punzocortantes",
    "Suplantación de identidad",
    "Tenencia o uso de explosivos o pirotécnicos",
    "Grabación o difusión íntima no consentida"
  ]
};

const LISTAS = {
  grados: Object.keys(GRADOS_SECCIONES),
  accionesTomadas: [
    "Llamado de atención",
    "Comunicación con tutor",
    "Comunicación con padre/madre",
    "Compromiso del estudiante",
    "Derivación a coordinación",
    "Derivación a dirección",
    "Otro"
  ]
};

// ================= ESTADO DE LA APLICACIÓN =================
let currentUser = null;
let alumnos = [];
let incidencias = [];
let unsubAlumnos = null;
let unsubIncidencias = null;

// ================= LOGIN Y ROLES =================
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const email = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();
  const errBox = document.getElementById("loginError");
  const btn = document.getElementById("btnLoginSubmit");

  btn.disabled = true;
  btn.textContent = "Verificando...";
  errBox.style.display = "none";

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (error) {
    console.error("Error de autenticación:", error);
    errBox.textContent = "Correo o contraseña incorrectos.";
    errBox.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar al Sistema";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    let role = "docente";
    try {
      const roleSnap = await getDoc(doc(db, "roles", user.email.toLowerCase()));
      if (roleSnap.exists() && roleSnap.data().rol === "admin") {
        role = "admin";
      }
    } catch (e) {
      console.warn("No se pudo verificar colección roles, asignando docente por defecto.");
    }

    currentUser = { email: user.email, role };
    iniciarSesion();
  } else {
    currentUser = null;
    if (unsubAlumnos) unsubAlumnos();
    if (unsubIncidencias) unsubIncidencias();
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
  }
});

function iniciarSesion() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContainer").style.display = "flex";
  document.getElementById("userDisplay").textContent =
    currentUser.role === "admin"
      ? `🛡️ Admin (${currentUser.email})`
      : `👨‍🏫 Docente (${currentUser.email})`;

  const isAdmin = currentUser.role === "admin";
  document.getElementById("cardFormAlumno").style.display = isAdmin ? "block" : "none";
  document.querySelectorAll(".admin-only-col").forEach(el => {
    el.style.display = isAdmin ? "table-cell" : "none";
  });

  inicializarSelects();
  escucharDatosEnTiempoReal();
}

window.logout = async function () {
  await signOut(auth);
  document.getElementById("loginForm").reset();
};

// ================= SINCRONIZACIÓN EN TIEMPO REAL =================
function escucharDatosEnTiempoReal() {
  unsubAlumnos = onSnapshot(collection(db, "alumnos"), (snapshot) => {
    alumnos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    alumnos.sort((a, b) => (a.nombres || "").localeCompare(b.nombres || ""));
    actualizarVistas();
  });

  const qInc = query(collection(db, "incidencias"), orderBy("fecha", "desc"));
  unsubIncidencias = onSnapshot(qInc, (snapshot) => {
    incidencias = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
    actualizarVistas();
  });
}

function actualizarVistas() {
  renderResumen();
  renderAlumnos();
  renderIncidencias();
  actualizarCampanaNotificaciones();
}

// ================= SIDEBAR DESPLEGABLE Y NAVEGACIÓN =================
document.getElementById("btnToggleSidebar").addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("collapsed");
});

window.switchTab = function (tabId, btn) {
  document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  btn.classList.add("active");

  if (window.innerWidth <= 860) {
    document.getElementById("sidebar").classList.remove("collapsed");
  }
};

function showToast(msg, isAlert = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = isAlert ? "toast alert-red" : "toast";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 4500);
}

// ================= CAMPANITA DE NOTIFICACIONES (3+ INCIDENCIAS) =================
window.toggleNotificaciones = function () {
  const dropdown = document.getElementById("notifDropdown");
  dropdown.classList.toggle("hidden");
};

document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".notif-wrapper");
  const dropdown = document.getElementById("notifDropdown");
  if (wrapper && !wrapper.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

function actualizarCampanaNotificaciones() {
  const alumnosEnAlerta = alumnos
    .map(a => ({ ...a, stats: getStatsAlumno(a.id) }))
    .filter(a => a.stats.count >= 3)
    .sort((a, b) => b.stats.count - a.stats.count);

  const badge = document.getElementById("bellBadge");
  const countText = document.getElementById("notifCountText");
  const list = document.getElementById("notifList");

  countText.textContent = `${alumnosEnAlerta.length} alumno(s)`;

  if (alumnosEnAlerta.length > 0) {
    badge.textContent = alumnosEnAlerta.length;
    badge.classList.remove("hidden");
    list.innerHTML = alumnosEnAlerta.map(a => `
      <div class="notif-item" onclick="irAAlumnoAlerta('${a.nombres.replace(/'/g, "\\'")}')">
        <div class="notif-item-title">⚠️ ${a.nombres}</div>
        <div class="notif-item-sub">${a.grado} - ${a.seccion} • <strong>${a.stats.count} incidencias</strong></div>
      </div>
    `).join("");
  } else {
    badge.classList.add("hidden");
    list.innerHTML = '<div class="notif-empty">Ningún alumno ha llegado a 3 incidencias.</div>';
  }
}

window.irAAlumnoAlerta = function (nombreAlumno) {
  document.getElementById("notifDropdown").classList.add("hidden");
  const btnAlumnos = document.querySelector('.nav-btn[data-tab="alumnos"]');
  switchTab("alumnos", btnAlumnos);
  document.getElementById("filtroAlumnos").value = nombreAlumno;
  renderAlumnos();
};

// ================= INICIALIZACIÓN DE SELECTS DINÁMICOS =================
function inicializarSelects() {
  fillSelect("aluGrado", LISTAS.grados);
  actualizarSeccionesAlumno();
  fillSelect("incAccion", LISTAS.accionesTomadas);

  const fAluGrado = document.getElementById("filtroAluGrado");
  const fIncGrado = document.getElementById("filtroIncGrado");
  fAluGrado.innerHTML = '<option value="">Todos los grados</option>';
  fIncGrado.innerHTML = '<option value="">Todos los grados</option>';
  LISTAS.grados.forEach(g => {
    fAluGrado.innerHTML += `<option value="${g}">${g}</option>`;
    fIncGrado.innerHTML += `<option value="${g}">${g}</option>`;
  });

  actualizarFiltroSecciones();
  document.getElementById("incFecha").value = new Date().toISOString().split("T")[0];
}

function fillSelect(id, items) {
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    sel.appendChild(opt);
  });
}

window.actualizarSeccionesAlumno = function () {
  const grado = document.getElementById("aluGrado").value;
  const secciones = GRADOS_SECCIONES[grado] || [];
  fillSelect("aluSeccion", secciones);
};

window.onFiltroGradoChange = function () {
  actualizarFiltroSecciones();
  renderAlumnos();
};

function actualizarFiltroSecciones() {
  const fGrado = document.getElementById("filtroAluGrado").value;
  const fSeccion = document.getElementById("filtroAluSeccion");
  fSeccion.innerHTML = '<option value="">Todas las secciones</option>';

  const secciones = fGrado
    ? (GRADOS_SECCIONES[fGrado] || [])
    : Object.values(GRADOS_SECCIONES).flat();

  secciones.forEach(sec => {
    fSeccion.innerHTML += `<option value="${sec}">${sec}</option>`;
  });
}

window.actualizarTiposPorGravedad = function () {
  const gravedad = document.getElementById("incGravedad").value;
  const selTipo = document.getElementById("incTipo");

  if (!gravedad || !INCIDENCIAS_POR_GRAVEDAD[gravedad]) {
    selTipo.innerHTML = '<option value="">-- Primero elija gravedad --</option>';
    selTipo.disabled = true;
    return;
  }

  selTipo.disabled = false;
  selTipo.innerHTML = '<option value="">-- Seleccione el tipo de falta --</option>';
  INCIDENCIAS_POR_GRAVEDAD[gravedad].forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    selTipo.appendChild(opt);
  });
};

// ================= AUTOCOMPLETADO DE ALUMNOS EN INCIDENCIAS =================
const inputSearchAlumno = document.getElementById("incAlumnoSearch");
const dropdownAutocomplete = document.getElementById("autocompleteDropdown");

inputSearchAlumno.addEventListener("input", function () {
  const texto = this.value.trim().toLowerCase();
  document.getElementById("incAlumnoId").value = "";
  document.getElementById("incGradoSeccion").value = "";

  if (!texto) {
    dropdownAutocomplete.classList.add("hidden");
    dropdownAutocomplete.innerHTML = "";
    return;
  }

  const coincidencias = alumnos.filter(a =>
    (a.nombres || "").toLowerCase().includes(texto)
  ).slice(0, 15);

  if (coincidencias.length === 0) {
    dropdownAutocomplete.innerHTML = '<div class="autocomplete-empty">No se encontraron alumnos con ese nombre o apellido.</div>';
    dropdownAutocomplete.classList.remove("hidden");
    return;
  }

  dropdownAutocomplete.innerHTML = coincidencias.map(a => `
    <div class="autocomplete-item" data-id="${a.id}">
      <strong>${a.nombres}</strong>
      <span>${a.grado} – ${a.seccion}</span>
    </div>
  `).join("");

  dropdownAutocomplete.querySelectorAll(".autocomplete-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.getAttribute("data-id");
      seleccionarAlumnoAutocomplete(id);
    });
  });

  dropdownAutocomplete.classList.remove("hidden");
});

function seleccionarAlumnoAutocomplete(id) {
  const alu = alumnos.find(a => a.id === id);
  if (!alu) return;

  document.getElementById("incAlumnoId").value = alu.id;
  document.getElementById("incAlumnoSearch").value = alu.nombres;
  document.getElementById("incGradoSeccion").value = `${alu.grado} - ${alu.seccion}`;
  dropdownAutocomplete.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-group")) {
    dropdownAutocomplete.classList.add("hidden");
  }
});

// ================= CÁLCULOS AUTOMÁTICOS =================
function getStatsAlumno(alumnoId) {
  const incAlu = incidencias.filter(i => i.alumnoId === alumnoId);
  const count = incAlu.length;
  const estado = count >= 3 ? "ADVERTENCIA" : "NORMAL";
  let ultimaFecha = "-";
  if (count > 0) {
    const fechas = incAlu.map(i => i.fecha).sort();
    ultimaFecha = fechas[fechas.length - 1];
  }
  return { count, estado, ultimaFecha };
}

// ================= IMPORTAR ALUMNOS DESDE EXCEL / CSV =================
window.descargarPlantillaExcel = function () {
  const datosEjemplo = [
    {
      "Apellidos y Nombres": "CHUQUIZUTA TAFUR SEGUNDO",
      "Grado": "TERCERO",
      "Sección": "ARGUEDAS",
      "Tutor/Docente": "Prof. Coordinación"
    },
    {
      "Apellidos y Nombres": "PEREZ GOMEZ MARIA LUISA",
      "Grado": "PRIMERO",
      "Sección": "AUSBEL",
      "Tutor/Docente": "Prof. Ramírez"
    }
  ];
  const hoja = XLSX.utils.json_to_sheet(datosEjemplo);

  hoja["!cols"] = [
    { wch: 35 }, // Apellidos y Nombres
    { wch: 15 }, // Grado
    { wch: 18 }, // Sección
    { wch: 28 }  // Tutor/Docente
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Alumnos");
  XLSX.writeFile(libro, "Plantilla_Alumnos_IE_Ramon_Castilla.xlsx");
};

function normalizarGrado(valor) {
  const txt = String(valor || "").trim().toUpperCase();
  if (txt.startsWith("1") || txt.includes("PRIM")) return "PRIMERO";
  if (txt.startsWith("2") || txt.includes("SEG")) return "SEGUNDO";
  if (txt.startsWith("3") || txt.includes("TER")) return "TERCERO";
  if (txt.startsWith("4") || txt.includes("CUAR")) return "CUARTO";
  if (txt.startsWith("5") || txt.includes("QUIN")) return "QUINTO";
  return "PRIMERO";
}

function normalizarSeccionPorGrado(grado, seccionRaw) {
  const validas = GRADOS_SECCIONES[grado] || [];
  const txt = String(seccionRaw || "").trim().toUpperCase();
  const match = validas.find(s => s.toUpperCase() === txt);
  return match || validas[0] || "";
}

window.importarAlumnosExcel = function (event) {
  if (currentUser?.role !== "admin") return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (rows.length === 0) {
        showToast("El archivo Excel/CSV está vacío.", true);
        return;
      }

      const batch = writeBatch(db);
      let procesados = 0;

      rows.forEach((row) => {
        const keys = Object.keys(row);
        const getCol = (posibles) => {
          const found = keys.find(k =>
            posibles.includes(k.trim().toUpperCase().replace(/\s+/g, " "))
          );
          return found ? String(row[found]).trim() : "";
        };

        const nombres = getCol([
          "APELLIDOS Y NOMBRES",
          "APELLIDOS_Y_NOMBRES",
          "NOMBRES Y APELLIDOS",
          "NOMBRES",
          "ALUMNO",
          "ESTUDIANTE"
        ]).toUpperCase();

        const gradoRaw = getCol(["GRADO"]);
        const seccionRaw = getCol(["SECCION", "SECCIÓN"]);

        const tutor = getCol([
          "TUTOR/DOCENTE",
          "TUTOR / DOCENTE",
          "TUTOR_DOCENTE",
          "TUTOR",
          "DOCENTE"
        ]);

        if (nombres) {
          const gradoNorm = normalizarGrado(gradoRaw);
          const seccionNorm = normalizarSeccionPorGrado(gradoNorm, seccionRaw);
          const docRef = doc(collection(db, "alumnos"));

          batch.set(docRef, {
            nombres,
            grado: gradoNorm,
            seccion: seccionNorm,
            tutor,
            observaciones: ""
          });
          procesados++;
        }
      });

      if (procesados === 0) {
        showToast("No se encontraron filas válidas. Verifique las columnas: Apellidos y Nombres, Grado, Sección, Tutor/Docente.", true);
        return;
      }

      await batch.commit();
      showToast(`✅ Se importaron ${procesados} alumnos (Nombres, Grado, Sección y Tutor/Docente).`);
    } catch (error) {
      console.error("Error importando Excel:", error);
      showToast("Error al leer o subir el archivo Excel/CSV.", true);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
};

// ================= CRUD ALUMNOS (SIN ID / DNI) =================
document.getElementById("formAlumno").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (currentUser?.role !== "admin") return;

  const editDocId = document.getElementById("editAlumnoDocId").value;
  const nombres = document.getElementById("aluNombres").value.trim().toUpperCase();
  const grado = document.getElementById("aluGrado").value;
  const seccion = document.getElementById("aluSeccion").value;
  const tutor = document.getElementById("aluTutor").value.trim();
  const observaciones = document.getElementById("aluObs").value.trim();

  try {
    if (editDocId) {
      await setDoc(doc(db, "alumnos", editDocId), { nombres, grado, seccion, tutor, observaciones }, { merge: true });
      cancelarEdicionAlumno();
      showToast("Datos del alumno actualizados en la nube.");
    } else {
      if (alumnos.some(a => a.nombres === nombres && a.grado === grado && a.seccion === seccion)) {
        showToast("Este estudiante ya está registrado en ese grado y sección.", true);
        return;
      }
      await addDoc(collection(db, "alumnos"), { nombres, grado, seccion, tutor, observaciones });
      this.reset();
      actualizarSeccionesAlumno();
      showToast("Alumno registrado exitosamente.");
    }
  } catch (err) {
    console.error(err);
    showToast("Error al guardar alumno en la base de datos.", true);
  }
});

window.editarAlumno = function (id) {
  if (currentUser?.role !== "admin") return;
  const alu = alumnos.find(a => a.id === id);
  if (!alu) return;

  document.getElementById("editAlumnoDocId").value = alu.id;
  document.getElementById("aluNombres").value = alu.nombres;
  document.getElementById("aluGrado").value = alu.grado;
  actualizarSeccionesAlumno();
  document.getElementById("aluSeccion").value = alu.seccion;
  document.getElementById("aluTutor").value = alu.tutor || "";
  document.getElementById("aluObs").value = alu.observaciones || "";

  document.getElementById("tituloFormAlumno").textContent = "Editando Alumno: " + alu.nombres;
  document.getElementById("btnGuardarAlumno").textContent = "Actualizar Datos";
  document.getElementById("btnCancelarEdicion").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.cancelarEdicionAlumno = function () {
  document.getElementById("editAlumnoDocId").value = "";
  document.getElementById("formAlumno").reset();
  actualizarSeccionesAlumno();
  document.getElementById("tituloFormAlumno").textContent = "Registrar / Actualizar Alumno";
  document.getElementById("btnGuardarAlumno").textContent = "Guardar Alumno";
  document.getElementById("btnCancelarEdicion").classList.add("hidden");
};

window.eliminarAlumno = async function (id) {
  if (currentUser?.role !== "admin") return;
  if (!confirm("¿Eliminar este alumno y todas sus incidencias asociadas?")) return;

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "alumnos", id));
    incidencias.filter(i => i.alumnoId === id).forEach(inc => {
      batch.delete(doc(db, "incidencias", inc.uid));
    });
    await batch.commit();
    showToast("Alumno eliminado del padrón.");
  } catch (err) {
    console.error(err);
    showToast("Error al eliminar alumno.", true);
  }
};

// ================= CRUD INCIDENCIAS =================
document.getElementById("formIncidencia").addEventListener("submit", async function (e) {
  e.preventDefault();
  const fecha = document.getElementById("incFecha").value;
  const alumnoId = document.getElementById("incAlumnoId").value;
  const gravedad = document.getElementById("incGravedad").value;
  const tipo = document.getElementById("incTipo").value;
  const accion = document.getElementById("incAccion").value;
  const docente = document.getElementById("incDocente").value.trim();
  const observaciones = document.getElementById("incObs").value.trim();
  const descripcion = document.getElementById("incDescripcion").value.trim();

  if (!alumnoId) {
    showToast("Debe seleccionar un estudiante válido de la lista desplegable.", true);
    document.getElementById("incAlumnoSearch").focus();
    return;
  }

  try {
    await addDoc(collection(db, "incidencias"), {
      fecha,
      alumnoId,
      gravedad,
      tipo,
      descripcion,
      accion,
      docente,
      observaciones,
      registradoPor: currentUser.email
    });

    const stats = getStatsAlumno(alumnoId);
    const nuevoTotal = stats.count + 1;
    const alu = alumnos.find(a => a.id === alumnoId);

    this.reset();
    document.getElementById("incAlumnoId").value = "";
    document.getElementById("incGradoSeccion").value = "";
    document.getElementById("incFecha").value = new Date().toISOString().split("T")[0];
    actualizarTiposPorGravedad();

    if (nuevoTotal >= 3) {
      showToast(`🚨 ALERTA: ${alu.nombres} acumuló ${nuevoTotal} incidencias (ESTADO: ADVERTENCIA).`, true);
    } else {
      showToast(`Incidencia guardada en la nube. Total del alumno: ${nuevoTotal}.`);
    }
  } catch (err) {
    console.error(err);
    showToast("Error al guardar la incidencia.", true);
  }
});

window.eliminarIncidencia = async function (uid) {
  if (currentUser?.role !== "admin") return;
  if (!confirm("¿Desea eliminar este registro de incidencia?")) return;

  try {
    await deleteDoc(doc(db, "incidencias", uid));
    showToast("Incidencia eliminada.");
  } catch (err) {
    console.error(err);
    showToast("Error al eliminar incidencia.", true);
  }
};

// ================= RENDERIZADO DE TABLAS Y RESUMEN =================
window.renderAlumnos = function () {
  const tbody = document.getElementById("tablaAlumnos");
  const q = document.getElementById("filtroAlumnos").value.toLowerCase();
  const fGrado = document.getElementById("filtroAluGrado").value;
  const fSeccion = document.getElementById("filtroAluSeccion").value;
  const fCantidad = document.getElementById("filtroAluCantidad").value;
  const isAdmin = currentUser && currentUser.role === "admin";

  tbody.innerHTML = "";

  const filtrados = alumnos.filter(a => {
    const stats = getStatsAlumno(a.id);
    const matchText = (a.nombres || "").toLowerCase().includes(q);
    const matchGrado = !fGrado || a.grado === fGrado;
    const matchSeccion = !fSeccion || a.seccion === fSeccion;

    let matchCantidad = true;
    if (fCantidad === "0") matchCantidad = stats.count === 0;
    else if (fCantidad === "1") matchCantidad = stats.count === 1;
    else if (fCantidad === "2") matchCantidad = stats.count === 2;
    else if (fCantidad === "3+") matchCantidad = stats.count >= 3;

    return matchText && matchGrado && matchSeccion && matchCantidad;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--slate-500);">No se encontraron alumnos con los filtros seleccionados.</td></tr>';
    return;
  }

  filtrados.forEach(a => {
    const stats = getStatsAlumno(a.id);
    const isAdv = stats.estado === "ADVERTENCIA";
    const tr = document.createElement("tr");
    if (isAdv) tr.className = "row-advertencia";

    tr.innerHTML = `
      <td><strong>${a.nombres}</strong></td>
      <td>${a.grado}</td>
      <td>${a.seccion}</td>
      <td>${a.tutor || "-"}</td>
      <td><span class="badge badge-count">${stats.count}</span></td>
      <td><span class="badge ${isAdv ? "badge-advertencia" : "badge-normal"}">${stats.estado}</span></td>
      <td>${stats.ultimaFecha}</td>
      <td>${a.observaciones || "-"}</td>
      <td style="display:${isAdmin ? "table-cell" : "none"}; white-space:nowrap;">
        <button class="btn btn-outline btn-sm" onclick="editarAlumno('${a.id}')">Editar</button>
        <button class="btn btn-danger" onclick="eliminarAlumno('${a.id}')">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

window.renderIncidencias = function () {
  const tbody = document.getElementById("tablaIncidencias");
  const q = document.getElementById("filtroIncidencias").value.toLowerCase();
  const fGrado = document.getElementById("filtroIncGrado").value;
  const isAdmin = currentUser && currentUser.role === "admin";

  tbody.innerHTML = "";

  const filtradas = incidencias.filter(inc => {
    const alu = alumnos.find(a => a.id === inc.alumnoId) || { nombres: "ALUMNO NO ENCONTRADO", grado: "", seccion: "" };
    const matchText =
      (alu.nombres || "").toLowerCase().includes(q) ||
      (inc.tipo || "").toLowerCase().includes(q) ||
      (inc.gravedad || "").toLowerCase().includes(q);
    const matchGrado = !fGrado || alu.grado === fGrado;
    return matchText && matchGrado;
  });

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--slate-500);">No hay incidencias registradas.</td></tr>';
    return;
  }

  filtradas.forEach(inc => {
    const alu = alumnos.find(a => a.id === inc.alumnoId) || { nombres: "ALUMNO NO ENCONTRADO", grado: "-", seccion: "-" };
    const stats = getStatsAlumno(inc.alumnoId);
    const tr = document.createElement("tr");
    if (stats.count >= 3) tr.className = "row-advertencia";

    const gravClass =
      inc.gravedad === "MUY GRAVE" ? "badge-advertencia" :
      inc.gravedad === "GRAVE" ? "badge-warn" : "badge-count";

    tr.innerHTML = `
      <td>${inc.fecha}</td>
      <td><strong>${alu.nombres}</strong></td>
      <td>${alu.grado}</td>
      <td>${alu.seccion}</td>
      <td><span class="badge ${gravClass}">${inc.gravedad || "LEVE"}</span></td>
      <td><strong>${inc.tipo}</strong></td>
      <td>${inc.descripcion || "-"}</td>
      <td>${inc.accion}</td>
      <td>${inc.docente}</td>
      <td style="display:${isAdmin ? "table-cell" : "none"};">
        <button class="btn btn-danger" onclick="eliminarIncidencia('${inc.uid}')">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

function renderResumen() {
  let totalAlu = 0, total1 = 0, total2 = 0, totalAdv = 0;
  const tbody = document.getElementById("tablaResumenGrados");
  const tfoot = document.getElementById("footResumenGrados");
  const chartBox = document.getElementById("graficoGrados");

  tbody.innerHTML = "";
  chartBox.innerHTML = "";

  const maxInc = Math.max(1, incidencias.length);

  LISTAS.grados.forEach(grado => {
    const aluGrado = alumnos.filter(a => a.grado === grado);
    let c1 = 0, c2 = 0, cAdv = 0;

    aluGrado.forEach(a => {
      const cnt = getStatsAlumno(a.id).count;
      if (cnt === 1) c1++;
      else if (cnt === 2) c2++;
      else if (cnt >= 3) cAdv++;
    });

    totalAlu += aluGrado.length;
    total1 += c1;
    total2 += c2;
    totalAdv += cAdv;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${grado}</strong></td>
      <td>${aluGrado.length}</td>
      <td>${c1}</td>
      <td>${c2}</td>
      <td><strong style="color:${cAdv > 0 ? "var(--red-600)" : "inherit"}">${cAdv}</strong></td>
    `;
    tbody.appendChild(tr);

    const incCountGrado = incidencias.filter(i => {
      const a = alumnos.find(al => al.id === i.alumnoId);
      return a && a.grado === grado;
    }).length;
    const pct = Math.round((incCountGrado / maxInc) * 100);

    chartBox.innerHTML += `
      <div class="bar-row">
        <span>${grado}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span>${incCountGrado} inc.</span>
      </div>
    `;
  });

  tfoot.innerHTML = `
    <tr>
      <td>TOTAL</td>
      <td>${totalAlu}</td>
      <td>${total1}</td>
      <td>${total2}</td>
      <td style="color:var(--red-700)">${totalAdv}</td>
    </tr>
  `;

  document.getElementById("kpiTotalAlumnos").textContent = totalAlu;
  document.getElementById("kpiTotalIncidencias").textContent = incidencias.length;
  document.getElementById("kpiRiesgo").textContent = total1 + total2;
  document.getElementById("kpiAdvertencia").textContent = totalAdv;

  const tbodyAdv = document.getElementById("tablaAdvertencias");
  tbodyAdv.innerHTML = "";
  const alumnosAdv = alumnos
    .map(a => ({ ...a, stats: getStatsAlumno(a.id) }))
    .filter(a => a.stats.count >= 3);

  if (alumnosAdv.length === 0) {
    tbodyAdv.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--slate-500);">Ningún estudiante registra 3 o más incidencias actualmente.</td></tr>';
  } else {
    alumnosAdv.forEach(a => {
      const tr = document.createElement("tr");
      tr.className = "row-advertencia";
      tr.innerHTML = `
        <td><strong>${a.nombres}</strong></td>
        <td>${a.grado}</td>
        <td>${a.seccion}</td>
        <td><strong>${a.stats.count}</strong></td>
        <td><span class="badge badge-advertencia">ADVERTENCIA</span></td>
      `;
      tbodyAdv.appendChild(tr);
    });
  }
}

// ================= EXPORTAR CSV COMPATIBLE CON EXCEL =================
window.exportarCSV = function () {
  let csv = "\uFEFFAPELLIDOS Y NOMBRES;GRADO;SECCION;TUTOR;N INCIDENCIAS;ESTADO;ULTIMA INCIDENCIA\n";
  alumnos.forEach(a => {
    const s = getStatsAlumno(a.id);
    csv += `"${a.nombres}";${a.grado};${a.seccion};"${a.tutor || ""}";${s.count};${s.estado};${s.ultimaFecha}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Reporte_Incidencias_IE_Ramon_Castilla_Luya.csv";
  link.click();
  URL.revokeObjectURL(url);
};