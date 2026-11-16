// ================= LISTAS DE APOYO (EXACTAS DEL EXCEL) =================
const LISTAS = {
  grados: ["1ro", "2do", "3ro", "4to", "5to"],
  secciones: ["A", "B", "C", "Única"],
  tiposIncidencia: [
    "Tardanza",
    "Inasistencia injustificada",
    "Falta de respeto",
    "Indisciplina",
    "Agresión física",
    "Agresión verbal",
    "Daño a bienes",
    "Uso inadecuado de celular",
    "Incumplimiento de norma",
    "Otro"
  ],
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

// ================= DATOS INICIALES DEL EXCEL =================
const DEFAULT_ALUMNOS = [
  {
    id: "71781050",
    nombres: "CHUQUIZUTA TAFUR SEGUNDO",
    grado: "3ro",
    seccion: "B",
    tutor: "Prof. Coordinación",
    observaciones: ""
  }
];

const DEFAULT_INCIDENCIAS = [
  {
    uid: 1,
    fecha: "2026-11-11",
    alumnoId: "71781050",
    tipo: "Tardanza",
    descripcion: "Ingreso fuera de hora reglamentaria",
    accion: "Llamado de atención",
    docente: "Docente de Turno",
    observaciones: ""
  },
  {
    uid: 2,
    fecha: "2026-11-12",
    alumnoId: "71781050",
    tipo: "Tardanza",
    descripcion: "Segunda tardanza consecutiva",
    accion: "Llamado de atención",
    docente: "Docente de Turno",
    observaciones: ""
  },
  {
    uid: 3,
    fecha: "2026-11-13",
    alumnoId: "71781050",
    tipo: "Tardanza",
    descripcion: "Tercera tardanza registrada",
    accion: "Llamado de atención",
    docente: "Docente de Turno",
    observaciones: ""
  }
];

// ================= ESTADO DE LA APLICACIÓN =================
let currentUser = null; // { role: 'admin' | 'docente', name: string }
let selectedLoginRole = "docente";
let alumnos = JSON.parse(localStorage.getItem("rc_luya_alumnos")) || DEFAULT_ALUMNOS;
let incidencias = JSON.parse(localStorage.getItem("rc_luya_incidencias")) || DEFAULT_INCIDENCIAS;

function saveData() {
  localStorage.setItem("rc_luya_alumnos", JSON.stringify(alumnos));
  localStorage.setItem("rc_luya_incidencias", JSON.stringify(incidencias));
}

// ================= LOGIN Y ROLES =================
function selectLoginRole(role) {
  selectedLoginRole = role;
  document.getElementById("tabRoleDocente").classList.toggle("active", role === "docente");
  document.getElementById("tabRoleAdmin").classList.toggle("active", role === "admin");
  document.getElementById("loginError").style.display = "none";
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const user = document.getElementById("loginUser").value.trim().toLowerCase();
  const pass = document.getElementById("loginPass").value.trim();
  const errBox = document.getElementById("loginError");

  if (selectedLoginRole === "admin" && user === "admin" && pass === "admin123") {
    currentUser = { role: "admin", name: "Administrador" };
  } else if (selectedLoginRole === "docente" && user === "docente" && pass === "docente123") {
    currentUser = { role: "docente", name: "Docente" };
  } else {
    errBox.style.display = "block";
    return;
  }

  errBox.style.display = "none";
  iniciarSesion();
});

function iniciarSesion() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContainer").style.display = "flex";
  document.getElementById("userDisplay").textContent =
    currentUser.role === "admin" ? "🛡️ Rol: Administrador" : "👨‍🏫 Rol: Docente";

  // Permisos según rol
  const isAdmin = currentUser.role === "admin";
  document.getElementById("cardFormAlumno").style.display = isAdmin ? "block" : "none";
  document.querySelectorAll(".admin-only-col").forEach(el => {
    el.style.display = isAdmin ? "table-cell" : "none";
  });

  if (!isAdmin) {
    document.getElementById("incDocente").value = "Docente";
  }

  inicializarSelects();
  actualizarTodo();
}

function logout() {
  currentUser = null;
  document.getElementById("loginForm").reset();
  document.getElementById("appContainer").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";
}

// ================= NAVEGACIÓN =================
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  btn.classList.add("active");
}

function showToast(msg, isAlert = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = isAlert ? "toast alert-red" : "toast";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3800);
}

// ================= INICIALIZAR LISTAS =================
function inicializarSelects() {
  fillSelect("aluGrado", LISTAS.grados);
  fillSelect("aluSeccion", LISTAS.secciones);
  fillSelect("incTipo", LISTAS.tiposIncidencia);
  fillSelect("incAccion", LISTAS.accionesTomadas);

  const fAluGrado = document.getElementById("filtroAluGrado");
  const fIncGrado = document.getElementById("filtroIncGrado");
  fAluGrado.innerHTML = '<option value="">Todos los grados</option>';
  fIncGrado.innerHTML = '<option value="">Todos los grados</option>';
  LISTAS.grados.forEach(g => {
    fAluGrado.innerHTML += `<option value="${g}">${g}</option>`;
    fIncGrado.innerHTML += `<option value="${g}">${g}</option>`;
  });

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

function actualizarTodo() {
  saveData();
  actualizarSelectAlumnosIncidencia();
  renderResumen();
  renderAlumnos();
  renderIncidencias();
}

function actualizarSelectAlumnosIncidencia() {
  const sel = document.getElementById("incAlumnoSelect");
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- Seleccione un estudiante --</option>';
  alumnos.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.id} - ${a.nombres} (${a.grado} "${a.seccion}")`;
    sel.appendChild(opt);
  });
  sel.value = currentVal;
}

function autocompletarAlumno() {
  const id = document.getElementById("incAlumnoSelect").value;
  const alu = alumnos.find(a => a.id === id);
  if (alu) {
    document.getElementById("incNombre").value = alu.nombres;
    document.getElementById("incGradoSeccion").value = `${alu.grado} - Sección ${alu.seccion}`;
  } else {
    document.getElementById("incNombre").value = "";
    document.getElementById("incGradoSeccion").value = "";
  }
}

// ================= CRUD ALUMNOS =================
document.getElementById("formAlumno").addEventListener("submit", function (e) {
  e.preventDefault();
  if (currentUser.role !== "admin") return;

  const originalId = document.getElementById("editAlumnoOriginalId").value;
  const id = document.getElementById("aluId").value.trim();
  const nombres = document.getElementById("aluNombres").value.trim().toUpperCase();
  const grado = document.getElementById("aluGrado").value;
  const seccion = document.getElementById("aluSeccion").value;
  const tutor = document.getElementById("aluTutor").value.trim();
  const observaciones = document.getElementById("aluObs").value.trim();

  if (originalId) {
    if (originalId !== id && alumnos.some(a => a.id === id)) {
      showToast("Ya existe otro alumno con ese ID.", true);
      return;
    }
    const idx = alumnos.findIndex(a => a.id === originalId);
    if (idx !== -1) {
      alumnos[idx] = { id, nombres, grado, seccion, tutor, observaciones };
      incidencias.forEach(inc => {
        if (inc.alumnoId === originalId) inc.alumnoId = id;
      });
    }
    cancelarEdicionAlumno();
    showToast("Datos del alumno actualizados correctamente.");
  } else {
    if (alumnos.some(a => a.id === id)) {
      showToast("El ID de alumno ya está registrado.", true);
      return;
    }
    alumnos.push({ id, nombres, grado, seccion, tutor, observaciones });
    this.reset();
    showToast("Alumno registrado exitosamente.");
  }

  actualizarTodo();
});

function editarAlumno(id) {
  if (currentUser.role !== "admin") return;
  const alu = alumnos.find(a => a.id === id);
  if (!alu) return;

  document.getElementById("editAlumnoOriginalId").value = alu.id;
  document.getElementById("aluId").value = alu.id;
  document.getElementById("aluNombres").value = alu.nombres;
  document.getElementById("aluGrado").value = alu.grado;
  document.getElementById("aluSeccion").value = alu.seccion;
  document.getElementById("aluTutor").value = alu.tutor || "";
  document.getElementById("aluObs").value = alu.observaciones || "";

  document.getElementById("tituloFormAlumno").textContent = "Editando Alumno: " + alu.nombres;
  document.getElementById("btnGuardarAlumno").textContent = "Actualizar Datos";
  document.getElementById("btnCancelarEdicion").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicionAlumno() {
  document.getElementById("editAlumnoOriginalId").value = "";
  document.getElementById("formAlumno").reset();
  document.getElementById("tituloFormAlumno").textContent = "Registrar / Actualizar Alumno";
  document.getElementById("btnGuardarAlumno").textContent = "Guardar Alumno";
  document.getElementById("btnCancelarEdicion").classList.add("hidden");
}

function eliminarAlumno(id) {
  if (currentUser.role !== "admin") return;
  if (!confirm("¿Eliminar este alumno y todas sus incidencias asociadas?")) return;
  alumnos = alumnos.filter(a => a.id !== id);
  incidencias = incidencias.filter(i => i.alumnoId !== id);
  actualizarTodo();
  showToast("Alumno eliminado del padrón.");
}

// ================= CRUD INCIDENCIAS =================
document.getElementById("formIncidencia").addEventListener("submit", function (e) {
  e.preventDefault();
  const fecha = document.getElementById("incFecha").value;
  const alumnoId = document.getElementById("incAlumnoSelect").value;
  const tipo = document.getElementById("incTipo").value;
  const accion = document.getElementById("incAccion").value;
  const docente = document.getElementById("incDocente").value.trim();
  const observaciones = document.getElementById("incObs").value.trim();
  const descripcion = document.getElementById("incDescripcion").value.trim();

  if (!alumnoId) {
    showToast("Debe seleccionar un estudiante válido.", true);
    return;
  }

  incidencias.unshift({
    uid: Date.now(),
    fecha,
    alumnoId,
    tipo,
    descripcion,
    accion,
    docente,
    observaciones
  });

  const stats = getStatsAlumno(alumnoId);
  const alu = alumnos.find(a => a.id === alumnoId);

  this.reset();
  document.getElementById("incFecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("incNombre").value = "";
  document.getElementById("incGradoSeccion").value = "";

  actualizarTodo();

  if (stats.count >= 3) {
    showToast(`⚠️ ALERTA: ${alu.nombres} acumuló ${stats.count} incidencias (ESTADO: ADVERTENCIA).`, true);
  } else {
    showToast(`Incidencia registrada. Total del alumno: ${stats.count}.`);
  }
});

function eliminarIncidencia(uid) {
  if (currentUser.role !== "admin") return;
  if (!confirm("¿Desea eliminar este registro de incidencia?")) return;
  incidencias = incidencias.filter(i => i.uid !== uid);
  actualizarTodo();
  showToast("Incidencia eliminada.");
}

// ================= RENDERIZADO DE TABLAS Y RESUMEN =================
function renderAlumnos() {
  const tbody = document.getElementById("tablaAlumnos");
  const q = document.getElementById("filtroAlumnos").value.toLowerCase();
  const fGrado = document.getElementById("filtroAluGrado").value;
  const fEstado = document.getElementById("filtroAluEstado").value;
  const isAdmin = currentUser && currentUser.role === "admin";

  tbody.innerHTML = "";

  const filtrados = alumnos.filter(a => {
    const stats = getStatsAlumno(a.id);
    const matchText = a.id.toLowerCase().includes(q) || a.nombres.toLowerCase().includes(q);
    const matchGrado = !fGrado || a.grado === fGrado;
    const matchEstado = !fEstado || stats.estado === fEstado;
    return matchText && matchGrado && matchEstado;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--slate-500);">No se encontraron alumnos con los filtros seleccionados.</td></tr>';
    return;
  }

  filtrados.forEach(a => {
    const stats = getStatsAlumno(a.id);
    const isAdv = stats.estado === "ADVERTENCIA";
    const tr = document.createElement("tr");
    if (isAdv) tr.className = "row-advertencia";

    tr.innerHTML = `
      <td><strong>${a.id}</strong></td>
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
}

function renderIncidencias() {
  const tbody = document.getElementById("tablaIncidencias");
  const q = document.getElementById("filtroIncidencias").value.toLowerCase();
  const fGrado = document.getElementById("filtroIncGrado").value;
  const isAdmin = currentUser && currentUser.role === "admin";

  tbody.innerHTML = "";

  const filtradas = incidencias.filter(inc => {
    const alu = alumnos.find(a => a.id === inc.alumnoId) || { nombres: "ID NO ENCONTRADO", grado: "", seccion: "" };
    const matchText =
      inc.alumnoId.toLowerCase().includes(q) ||
      alu.nombres.toLowerCase().includes(q) ||
      inc.tipo.toLowerCase().includes(q);
    const matchGrado = !fGrado || alu.grado === fGrado;
    return matchText && matchGrado;
  });

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--slate-500);">No hay incidencias registradas.</td></tr>';
    return;
  }

  filtradas.forEach(inc => {
    const alu = alumnos.find(a => a.id === inc.alumnoId) || { nombres: "ID NO ENCONTRADO", grado: "-", seccion: "-" };
    const stats = getStatsAlumno(inc.alumnoId);
    const tr = document.createElement("tr");
    if (stats.count >= 3) tr.className = "row-advertencia";

    tr.innerHTML = `
      <td>${inc.fecha}</td>
      <td><strong>${inc.alumnoId}</strong></td>
      <td>${alu.nombres}</td>
      <td>${alu.grado}</td>
      <td>${alu.seccion}</td>
      <td><strong>${inc.tipo}</strong></td>
      <td>${inc.descripcion || "-"}</td>
      <td>${inc.accion}</td>
      <td>${inc.docente}</td>
      <td style="display:${isAdmin ? "table-cell" : "none"};">
        <button class="btn btn-danger" onclick="eliminarIncidencia(${inc.uid})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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
        <span>${grado} Grado</span>
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
    tbodyAdv.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--slate-500);">Ningún estudiante registra 3 o más incidencias actualmente.</td></tr>';
  } else {
    alumnosAdv.forEach(a => {
      const tr = document.createElement("tr");
      tr.className = "row-advertencia";
      tr.innerHTML = `
        <td><strong>${a.id}</strong></td>
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
function exportarCSV() {
  let csv = "\uFEFFID ALUMNO;APELLIDOS Y NOMBRES;GRADO;SECCION;TUTOR;N INCIDENCIAS;ESTADO;ULTIMA INCIDENCIA\n";
  alumnos.forEach(a => {
    const s = getStatsAlumno(a.id);
    csv += `${a.id};"${a.nombres}";${a.grado};${a.seccion};"${a.tutor || ""}";${s.count};${s.estado};${s.ultimaFecha}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Reporte_Incidencias_IE_Ramon_Castilla_Luya.csv";
  link.click();
  URL.revokeObjectURL(url);
}