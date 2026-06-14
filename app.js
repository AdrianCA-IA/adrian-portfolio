/**
 * Adrian Cajas — Data Engineer & AI Portfolio
 * Main application script
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
   * SECTION: Particles (blue network background)
   * ═══════════════════════════════════════════════ */
  const c = document.getElementById('pCanvas');
  const x = c?.getContext('2d');
  let pts = [];
  let m = { x: null, y: null };
  /** @type {number|null} */
  let animId = null;
  let particlesRunning = false;

  /** Responsive particle count — fewer on mobile */
  const PARTICLE_COUNT = window.innerWidth < 768 ? 50 : 90;

  function resize() {
    if (!c) return;
    c.width = innerWidth;
    c.height = innerHeight;
  }
  resize();
  addEventListener('resize', resize);
  document.addEventListener('mousemove', function (e) {
    m.x = e.clientX;
    m.y = e.clientY;
  });

  /** Particle class */
  class P {
    constructor() {
      this.x = Math.random() * c.width;
      this.y = Math.random() * c.height;
      this.vx = (Math.random() - 0.5) * 0.45;
      this.vy = (Math.random() - 0.5) * 0.45;
      this.r = Math.random() * 2.2 + 0.6;
      this.pulse = Math.random() * Math.PI * 2;
      this.pulseSpeed = 0.008 + Math.random() * 0.015;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > c.width) this.vx *= -1;
      if (this.y < 0 || this.y > c.height) this.vy *= -1;
    }
    draw() {
      this.pulse += this.pulseSpeed;
      var alpha = 0.35 + Math.sin(this.pulse) * 0.15;
      var drawR = this.r + Math.sin(this.pulse) * 0.4;
      /* Glow */
      x.beginPath();
      x.arc(this.x, this.y, drawR + 3, 0, Math.PI * 2);
      x.fillStyle = 'rgba(160,201,203,' + (alpha * 0.12) + ')';
      x.fill();
      /* Core */
      x.beginPath();
      x.arc(this.x, this.y, drawR, 0, Math.PI * 2);
      x.fillStyle = 'rgba(160,201,203,' + alpha + ')';
      x.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) pts.push(new P());

  /** Main animation loop */
  function anim() {
    if (!x) return;
    x.clearRect(0, 0, c.width, c.height);
    pts.forEach(function (p) { p.update(); p.draw(); });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 160) {
          x.beginPath();
          x.moveTo(pts[i].x, pts[i].y);
          x.lineTo(pts[j].x, pts[j].y);
          x.strokeStyle = 'rgba(160,201,203,' + (0.14 * (1 - d / 160)) + ')';
          x.lineWidth = 0.8;
          x.stroke();
        }
      }
      if (m.x !== null) {
        const dx = pts[i].x - m.x;
        const dy = pts[i].y - m.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 200) {
          x.beginPath();
          x.moveTo(pts[i].x, pts[i].y);
          x.lineTo(m.x, m.y);
          x.strokeStyle = 'rgba(255,177,98,' + (0.25 * (1 - d / 200)) + ')';
          x.lineWidth = 1;
          x.stroke();
        }
      }
    }
    animId = requestAnimationFrame(anim);
  }

  /** Start particles if motion is allowed */
  function startParticles() {
    if (particlesRunning) return;
    particlesRunning = true;
    animId = requestAnimationFrame(anim);
  }

  /** Stop particles */
  function stopParticles() {
    if (!particlesRunning) return;
    particlesRunning = false;
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  if (!matchMedia('(prefers-reduced-motion:reduce)').matches) {
    startParticles();
  }

  /** Pause particles when tab is hidden, resume when visible */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopParticles();
    } else if (!matchMedia('(prefers-reduced-motion:reduce)').matches) {
      startParticles();
    }
  });

  /* ═══════════════════════════════════════════════
   * SECTION: Dynamic year in footer
   * ═══════════════════════════════════════════════ */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ═══════════════════════════════════════════════
   * SECTION: Dynamic experience years
   * ═══════════════════════════════════════════════ */
  const startDate = new Date('2018-03-01');
  const expYears = Math.floor((Date.now() - startDate) / 31557600000);

  /** Update hero stat KPI and hero-sub text with dynamic years */
  function updateExpYears() {
    var kpiEl = document.getElementById('yearsKpi');
    if (kpiEl) kpiEl.textContent = expYears + '+';

    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) {
      const esText = heroSub.getAttribute('data-es');
      const enText = heroSub.getAttribute('data-en');
      if (esText) {
        heroSub.setAttribute('data-es', esText.replace(/\+\d+/, '+' + expYears));
      }
      if (enText) {
        heroSub.setAttribute('data-en', enText.replace(/\d+\+/, expYears + '+'));
      }
      heroSub.textContent = heroSub.getAttribute('data-' + currentLang);
    }
  }

  /* ═══════════════════════════════════════════════
   * SECTION: Language toggle
   * ═══════════════════════════════════════════════ */
  let currentLang = (function(){ try{ var s=localStorage.getItem('portfolio-lang'); return (s==='en')?'en':'es'; }catch(e){ return 'es'; } })();

  function applyLang(){
    document.documentElement.setAttribute('data-lang', currentLang);
    document.documentElement.lang = currentLang;
    if(langBtnEl){
      langBtnEl.textContent = currentLang === 'es' ? 'ES / EN' : 'EN / ES';
      langBtnEl.setAttribute('aria-label', currentLang === 'es' ? 'Cambiar idioma a inglés' : 'Switch language to Spanish');
    }
    document.querySelectorAll('[data-es][data-en]').forEach(function (el) {
      const t = el.getAttribute('data-' + currentLang);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = t;
      } else if (el.children.length > 0) {
        for (var i = 0; i < el.childNodes.length; i++) {
          var node = el.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
            node.textContent = t;
          }
        }
      } else {
        el.textContent = t;
      }
    });
    buildMap();
    buildTabs();
    buildEdu();
    updateExpYears();
    updateCvBtnText();
  }

  var langBtnEl = document.getElementById('langBtn');
  if (langBtnEl) {
    langBtnEl.addEventListener('click', function () {
      currentLang = currentLang === 'es' ? 'en' : 'es';
      try{ localStorage.setItem('portfolio-lang', currentLang); }catch(e){}
      applyLang();
    });
  }

  // Language is applied at the end of the file, after all data/functions are defined.

  /* ═══════════════════════════════════════════════
   * SECTION: Mobile menu
   * ═══════════════════════════════════════════════ */
  document.getElementById('mobBtn')?.addEventListener('click', function () {
    document.getElementById('navLinks')?.classList.toggle('open');
  });
  document.querySelectorAll('.nav-links a').forEach(function (l) {
    l.addEventListener('click', function () {
      document.getElementById('navLinks')?.classList.remove('open');
    });
  });

  /* ═══════════════════════════════════════════════
   * SECTION: Scroll — nav style + smooth anchors
   * ═══════════════════════════════════════════════ */
  addEventListener('scroll', function () {
    document.querySelector('.nav')?.classList.toggle('scrolled', scrollY > 50);
  });
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      const t = document.querySelector(this.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ═══════════════════════════════════════════════
   * SECTION: Scroll progress bar (uses #scrollProgress from HTML)
   * ═══════════════════════════════════════════════ */
  const progressBar = document.getElementById('scrollProgress');

  addEventListener('scroll', function () {
    const docH = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const pct = docH > 0 ? (scrollY / docH) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
  });

  /* ═══════════════════════════════════════════════
   * SECTION: Scroll-to-top button (uses #scrollTop from HTML)
   * ═══════════════════════════════════════════════ */
  const topBtn = document.getElementById('scrollTop');
  if (topBtn) {
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    addEventListener('scroll', function () {
      topBtn.classList.toggle('vis', scrollY > 400);
    });
  }

  /* ═══════════════════════════════════════════════
   * SECTION: Intersection observer for reveals
   * ═══════════════════════════════════════════════ */
  const obs = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add('vis');
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
  );
  document.querySelectorAll('.reveal,.edu-item').forEach(function (el) { obs.observe(el); });

  /* ═══════════════════════════════════════════════
   * SECTION: Mind map data
   * ═══════════════════════════════════════════════ */
  const mapData = [
    {
      name: { es: 'Big Data & Cloud', en: 'Big Data & Cloud' },
      color: '#FFB162', bg: 'rgba(255,177,98,0.12)',
      kpi: { es: 'Migración masiva de datos entre plataformas Salesforce, procesamiento de millones de registros con Informatica Cloud y monitorización con Control-M.', en: 'Massive data migration between Salesforce platforms, processing millions of records with Informatica Cloud and Control-M monitoring.' },
      children: [
        { name: 'Informatica Cloud', lvl: 85, subs: ['Data Integration', 'Mass Ingestion', 'Mappings', 'Taskflows', 'Secure Agent'] },
        { name: 'IICS', lvl: 80, subs: ['CDI', 'CAI', 'Connectors', 'Secure Agent', 'REST API'] },
        { name: 'AWS', lvl: 65, subs: ['EC2', 'S3', 'Athena', 'DynamoDB', 'ECS', 'Lambda'] },
        { name: 'Spark / Scala', lvl: 45, subs: ['SparkSQL', 'RDDs', 'DataFrames', 'Functional Programming'] },
        { name: 'HDFS / Hive', lvl: 50, subs: ['File Management', 'HiveQL', 'Partitions', 'Replication'] }
      ]
    },
    {
      name: { es: 'IA & Agentes', en: 'AI & Agents' },
      color: '#A0C9CB', bg: 'rgba(160,201,203,0.12)',
      kpi: { es: 'Agentes de IA aplicados a casos reales: gestor de llamadas con IA, agente de citas por WhatsApp sincronizado con Google Calendar y automatización interna con APIs de Claude y Gemini.', en: 'AI agents applied to real cases: AI call manager, WhatsApp booking agent synced with Google Calendar, and internal automation with Claude and Gemini APIs.' },
      children: [
        { name: 'LLMs', lvl: 60, subs: ['Claude', 'Gemini', 'GPT', 'Prompt Engineering', 'Context Engineering'] },
        { name: 'APIs de IA', lvl: 65, subs: ['Claude API', 'Gemini API', 'REST Integration', 'Webhooks'] },
        { name: 'Multi-agentes', lvl: 55, subs: ['Orquestación', 'Delegación de tareas', 'Agent SDK', 'MCP'] },
        { name: 'Ollama', lvl: 40, subs: ['Modelos locales', 'Llama', 'Mistral', 'Embeddings'] },
        { name: 'RAG', lvl: 40, subs: ['Vector DB', 'Chunking', 'Retrieval', 'Embeddings'] }
      ]
    },
    {
      name: { es: 'Data Insights', en: 'Data Insights' },
      color: '#d45c7e', bg: 'rgba(107,26,52,0.18)',
      kpi: { es: 'Creación de dashboards en Power BI integrando fuentes de datos heterogéneas mediante Power Query para la toma de decisiones.', en: 'Creation of Power BI dashboards integrating heterogeneous data sources via Power Query for decision making.' },
      children: [
        { name: 'SQL', lvl: 70, subs: ['PostgreSQL', 'MySQL', 'Oracle SQL', 'T-SQL', 'Joins complejos'] },
        { name: 'NoSQL', lvl: 65, subs: ['MongoDB', 'DynamoDB', 'Collections', 'Aggregation'] },
        { name: 'Power BI', lvl: 50, subs: ['Dashboards', 'DAX', 'Data Model', 'Visualizaciones'] },
        { name: 'Power Query', lvl: 55, subs: ['M Language', 'Transformaciones', 'Connectors', 'Merge'] }
      ]
    },
    {
      name: { es: 'Automatización', en: 'Automation' },
      color: '#A0C9CB', bg: 'rgba(160,201,203,0.12)',
      kpi: { es: 'Desarrollo de herramientas personalizadas utilizando APIs de Claude y Gemini para la automatización de procesos internos.', en: 'Development of custom tools using Claude and Gemini APIs for internal process automation.' },
      children: [
        { name: 'Python', lvl: 85, subs: ['Pandas', 'NumPy', 'Jupyter', 'Scikit-learn', 'Flask', 'Automation scripts'] },
        { name: 'Power Automate', lvl: 40, subs: ['Flows', 'Triggers', 'Connectors', 'Approval workflows'] },
        { name: 'Control-M', lvl: 65, subs: ['Job Scheduling', 'Monitoring', 'Alerts', 'Batch processing'] },
        { name: 'Docker', lvl: 55, subs: ['Dockerfile', 'Compose', 'Images', 'Containerization'] }
      ]
    }
  ];

  /* ═══════════════════════════════════════════════
   * SECTION: Build mind map
   * ═══════════════════════════════════════════════ */
  /** @description Renders the skill mind-map nodes into #mmGrid */
  function buildMap() {
    const g = document.getElementById('mmGrid');
    if (!g) return;
    g.innerHTML = '';
    mapData.forEach(function (cat) {
      const n = document.createElement('div');
      n.className = 'mm-node reveal';
      const cName = currentLang === 'en' ? cat.name.en : cat.name.es;
      const kpiText = currentLang === 'en' ? cat.kpi.en : cat.kpi.es;
      n.innerHTML =
        '<div class="mm-head">' +
          '<div class="mm-ico" style="background:' + cat.bg + ';color:' + cat.color + '">' +
            '<svg class="icon-s" viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' +
          '</div>' +
          '<span class="mm-name">' + cName + '</span>' +
          '<span class="mm-cnt">' + cat.children.length + '</span>' +
          '<svg class="mm-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="mm-body"><div class="mm-body-inner">' +
          cat.children.map(function (ch) {
            var subsHtml = '';
            if (ch.subs && ch.subs.length) {
              subsHtml =
                '<svg class="mm-child-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
                '<div class="mm-subs"><div class="mm-subs-inner">' +
                  ch.subs.map(function (s) {
                    return '<div class="mm-sub"><div class="mm-sub-dot" style="background:' + cat.color + '"></div>' + s + '</div>';
                  }).join('') +
                '</div></div>';
            }
            return '<div class="mm-child" data-has-subs="' + (ch.subs && ch.subs.length ? 'true' : 'false') + '">' +
              '<div class="mm-child-dot" style="background:' + cat.color + '"></div>' +
              '<span class="mm-child-name">' + ch.name + '</span>' +
              '<span class="mm-child-lvl">' + ch.lvl + '%</span>' +
              '<div class="mm-child-bar" role="progressbar" aria-valuenow="' + ch.lvl + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + ch.name + ' ' + ch.lvl + '%"><div class="mm-child-fill" style="width:' + ch.lvl + '%;background:' + cat.color + '"></div></div>' +
              subsHtml +
            '</div>';
          }).join('') +
          '<div class="mm-kpi" data-es="' + cat.kpi.es + '" data-en="' + cat.kpi.en + '">' + kpiText + '</div>' +
        '</div></div>';
      n.querySelector('.mm-head').addEventListener('click', function () { n.classList.toggle('open'); });
      g.appendChild(n);
      obs.observe(n);
    });
    document.querySelectorAll('.mm-child[data-has-subs="true"]').forEach(function (ch) {
      ch.addEventListener('click', function (e) {
        e.stopPropagation();
        ch.classList.toggle('open');
      });
    });
  }
  buildMap();

  /* ═══════════════════════════════════════════════
   * SECTION: Experience tabs data
   * ═══════════════════════════════════════════════ */
  const expData = [
    {
      company: 'Torres y Carrera', role: { es: 'Data Analyst & AI Solutions', en: 'Data Analyst & AI Solutions' },
      date: 'Nov 2025 — Actualidad',
      tasks: {
        es: ['Automatización de procesos internos con soluciones basadas en IA', 'Implementación de herramientas de IA modernas (LLMs, APIs) para optimizar flujos de trabajo', 'Análisis de datos con Excel, Power BI, Power Query y Power Automate', 'Búsqueda y evaluación de soluciones tecnológicas innovadoras con IA'],
        en: ['Internal process automation with AI-based solutions', 'Implementation of modern AI tools (LLMs, APIs) to optimize workflows', 'Data analysis with Excel, Power BI, Power Query and Power Automate', 'Research and evaluation of innovative AI-driven tech solutions']
      },
      kpis: { es: ['IA + LLMs', 'Power BI', 'Automatización'], en: ['AI + LLMs', 'Power BI', 'Automation'] }
    },
    {
      company: 'CAS Training', role: { es: 'Desarrollador Big Data', en: 'Big Data Developer' },
      date: 'Jul 2022 — Feb 2025',
      tasks: {
        es: ['Código en Scala para informes de ejecución y consultas HDFS', 'Validación de calidad de datos y gestión de tablas temporales', 'Python / Jupyter para extracción de datos y exportación', 'Monitorización de procesos con Control-M y ServiceNow'],
        en: ['Scala code for execution reports and HDFS queries', 'Data quality validation and temp table management', 'Python / Jupyter for data extraction and export', 'Process monitoring with Control-M and ServiceNow']
      },
      kpis: { es: ['Scala + HDFS', 'Control-M', 'Data Quality'], en: ['Scala + HDFS', 'Control-M', 'Data Quality'] }
    },
    {
      company: 'Pixie', role: { es: 'Desarrollador ETL', en: 'ETL Developer' },
      date: 'Feb — Jul 2022',
      tasks: {
        es: ['Procesos ETL con IICS: integración de datos Oracle a Salesforce', 'Gestión de cargas iniciales e incrementales con transformación y limpieza'],
        en: ['ETL processes with IICS: Oracle to Salesforce data integration', 'Initial and incremental load management with transformation and cleaning']
      },
      kpis: { es: ['IICS', 'Oracle → Salesforce', 'ETL Pipeline'], en: ['IICS', 'Oracle → Salesforce', 'ETL Pipeline'] }
    },
    {
      company: 'VASS', role: { es: 'Desarrollador ETL', en: 'ETL Developer' },
      date: 'Abr — Nov 2020',
      tasks: {
        es: ['Migración masiva de datos con Informatica Cloud (Salesforce ↔ Salesforce)', 'Lógica de transformación basada en dependencias entre registros'],
        en: ['Massive data migration with Informatica Cloud (Salesforce ↔ Salesforce)', 'Dependency-based transformation logic between records']
      },
      kpis: { es: ['Migración masiva', 'Informatica Cloud', 'Dependencias'], en: ['Mass migration', 'Informatica Cloud', 'Dependencies'] }
    },
    {
      company: 'Stratesys', role: { es: 'Analista de Datos', en: 'Data Analyst' },
      date: 'Abr 2019 — Abr 2020',
      tasks: {
        es: ['Automatización de pipelines ETL y validación de calidad', 'Procesamiento avanzado de datos con Informatica Cloud'],
        en: ['ETL pipeline automation and quality validation', 'Advanced data processing with Informatica Cloud']
      },
      kpis: { es: ['Automatización ETL', 'Calidad de datos'], en: ['ETL Automation', 'Data Quality'] }
    },
    {
      company: 'Jump Data Driven', role: { es: 'QA & Cloud (Prácticas)', en: 'QA & Cloud (Internship)' },
      date: 'Mar 2018 — Abr 2019',
      tasks: {
        es: ['Automatización de pruebas UI con Ruby y Selenium', 'Soporte en integración de algoritmos de IA en AWS (EC2, ECS, S3, Athena)'],
        en: ['UI test automation with Ruby and Selenium', 'AI algorithm integration support in AWS (EC2, ECS, S3, Athena)']
      },
      kpis: { es: ['Ruby + Selenium', 'AWS', 'IA Integration'], en: ['Ruby + Selenium', 'AWS', 'AI Integration'] }
    }
  ];

  /* ═══════════════════════════════════════════════
   * SECTION: Build experience tabs (ARIA tabs pattern)
   * ═══════════════════════════════════════════════ */
  /** @description Renders experience tabs with full ARIA tab pattern and keyboard nav */
  function buildTabs() {
    const row = document.getElementById('tabsRow');
    const panels = document.getElementById('tabPanels');
    if (!row || !panels) return;
    row.innerHTML = '';
    panels.innerHTML = '';
    row.setAttribute('role', 'tablist');

    expData.forEach(function (e, i) {
      var lang = currentLang;
      var btn = document.createElement('button');
      btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
      btn.textContent = e.company;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'tp-' + i);
      btn.id = 'tab-' + i;
      btn.setAttribute('tabindex', i === 0 ? '0' : '-1');

      btn.addEventListener('click', function () {
        activateTab(i);
      });

      row.appendChild(btn);

      var panel = document.createElement('div');
      panel.className = 'tab-panel' + (i === 0 ? ' active' : '');
      panel.id = 'tp-' + i;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'tab-' + i);

      /* BUG FIX #1: use index-based mapping instead of indexOf to avoid failures with repeated text */
      panel.innerHTML =
        '<div class="tp-header">' +
          '<span class="tp-company">' + e.company + '</span>' +
          '<span class="tp-role" data-es="' + e.role.es + '" data-en="' + e.role.en + '">' + e.role[lang] + '</span>' +
          '<span class="tp-date">' + e.date + '</span>' +
        '</div>' +
        '<ul class="tp-tasks">' +
          e.tasks[lang].map(function (t, idx) {
            return '<li data-es="' + e.tasks.es[idx] + '" data-en="' + e.tasks.en[idx] + '">' + t + '</li>';
          }).join('') +
        '</ul>' +
        '<div class="tp-kpis">' +
          e.kpis[lang].map(function (k, ki) {
            return '<span class="tp-kpi" data-es="' + e.kpis.es[ki] + '" data-en="' + e.kpis.en[ki] + '">' + k + '</span>';
          }).join('') +
        '</div>';

      panels.appendChild(panel);
    });

    /** Keyboard navigation for ARIA tabs */
    row.addEventListener('keydown', function (ev) {
      var tabs = Array.from(row.querySelectorAll('[role="tab"]'));
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;

      var next = -1;
      if (ev.key === 'ArrowRight') {
        next = (current + 1) % tabs.length;
      } else if (ev.key === 'ArrowLeft') {
        next = (current - 1 + tabs.length) % tabs.length;
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        activateTab(current);
        return;
      }

      if (next >= 0) {
        ev.preventDefault();
        tabs[next].focus();
        tabs.forEach(function (t, ti) {
          t.setAttribute('tabindex', ti === next ? '0' : '-1');
        });
      }
    });
  }

  /** @description Activate a specific tab by index */
  function activateTab(index) {
    document.querySelectorAll('.tab-btn').forEach(function (b, bi) {
      b.classList.toggle('active', bi === index);
      b.setAttribute('aria-selected', bi === index ? 'true' : 'false');
      b.setAttribute('tabindex', bi === index ? '0' : '-1');
    });
    document.querySelectorAll('.tab-panel').forEach(function (p, pi) {
      p.classList.toggle('active', pi === index);
    });
  }

  buildTabs();

  /* ═══════════════════════════════════════════════
   * SECTION: Education data
   * ═══════════════════════════════════════════════ */
  const eduData = [
    { title: { es: 'Programa Avanzado en Inteligencia Artificial — Atrium', en: 'Advanced AI Program — Atrium' }, date: { es: 'Feb 2025 — Jul 2025 (Certificado + Prácticas)', en: 'Feb 2025 — Jul 2025 (Certificate + Internship)' }, desc: { es: 'Formación intensiva en IA: administración Linux, Python avanzado, SQL y NoSQL, Machine Learning, Deep Learning, LLMs. Incluye prácticas profesionales.', en: 'Intensive AI training: Linux administration, advanced Python, SQL and NoSQL, Machine Learning, Deep Learning, LLMs. Includes professional internship.' } },
    { title: { es: 'FP Superior — Desarrollo de Aplicaciones Multiplataforma (DAM)', en: 'Higher Vocational — Cross-platform App Development (DAM)' }, date: { es: '2016 — 2018', en: '2016 — 2018' }, desc: { es: 'Programación orientada a objetos, gestión de datos, lenguajes de marcas.', en: 'Object-oriented programming, data management, markup languages.' } },
    { title: { es: 'Curso de Desarrollo Big Data con Cloudera', en: 'Big Data Development Course with Cloudera' }, date: { es: '2017 — 2018', en: '2017 — 2018' }, desc: { es: 'Administración y desarrollo con Cloudera, Spark, Pig, Hive. Proyecto de ingestión y visualización de datos de Twitter.', en: 'Cloudera administration and development, Spark, Pig, Hive. Twitter data ingestion and visualization project.' } }
  ];

  /* ═══════════════════════════════════════════════
   * SECTION: Build education timeline
   * ═══════════════════════════════════════════════ */
  /** @description Renders education timeline entries into #eduLine */
  function buildEdu() {
    const line = document.getElementById('eduLine');
    if (!line) return;
    line.innerHTML = '';
    eduData.forEach(function (e) {
      var lang = currentLang;
      var item = document.createElement('div');
      item.className = 'edu-item';
      item.innerHTML =
        '<div class="edu-dot"></div>' +
        '<div class="edu-card">' +
          '<div class="edu-title" data-es="' + e.title.es + '" data-en="' + e.title.en + '">' + e.title[lang] + '</div>' +
          '<div class="edu-date" data-es="' + e.date.es + '" data-en="' + e.date.en + '">' + e.date[lang] + '</div>' +
          '<div class="edu-desc" data-es="' + e.desc.es + '" data-en="' + e.desc.en + '">' + e.desc[lang] + '</div>' +
        '</div>';
      line.appendChild(item);
      obs.observe(item);
    });
  }
  buildEdu();

  /* ═══════════════════════════════════════════════
   * SECTION: Contact form (Formspree) with honeypot,
   *          AbortController timeout, char counter,
   *          and aria-live status message
   * ═══════════════════════════════════════════════ */
  const cForm = document.getElementById('contactForm');
  if (cForm) {
    /** Honeypot field — uses existing hidden input from HTML */
    var honeypotField = cForm.querySelector('input[name="_gotcha"]');

    /** Character counter — uses existing #charCount from HTML */
    var textarea = cForm.querySelector('textarea');
    var counter = document.getElementById('charCount');
    if (textarea && counter) {
      textarea.addEventListener('input', function () {
        var len = textarea.value.length;
        counter.textContent = len + ' / 2000';
        counter.className = 'char-count' + (len > 1800 ? (len >= 2000 ? ' over' : ' warn') : '');
      });
    }

    /** Status message — uses existing #formStatus from HTML */
    var statusDiv = document.getElementById('formStatus');

    cForm.addEventListener('submit', async function (ev) {
      ev.preventDefault();

      /** Honeypot check — if filled, silently pretend success */
      if (honeypotField && honeypotField.value) {
        if (statusDiv) { statusDiv.textContent = currentLang === 'es' ? 'Mensaje enviado.' : 'Message sent.'; statusDiv.className = 'form-status success'; }
        cForm.reset();
        return;
      }

      var btn = document.getElementById('contactBtn');
      var origText = btn?.textContent || '';
      if (btn) {
        btn.textContent = currentLang === 'es' ? 'Enviando...' : 'Sending...';
        btn.disabled = true;
      }
      if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = 'form-status'; }

      /** AbortController with 10s timeout */
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 10000);

      try {
        var res = await fetch(cForm.action, {
          method: 'POST',
          body: new FormData(cForm),
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
          if (statusDiv) { statusDiv.textContent = currentLang === 'es' ? 'Mensaje enviado correctamente.' : 'Message sent successfully.'; statusDiv.className = 'form-status success'; }
          if (btn) { btn.style.background = '#10b981'; }
          cForm.reset();
          if (counter) counter.textContent = '0 / 2000';
          setTimeout(function () {
            if (btn) { btn.textContent = origText; btn.style.background = ''; btn.disabled = false; }
            if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = 'form-status'; }
          }, 3000);
        } else {
          throw new Error('fail');
        }
      } catch (err) {
        clearTimeout(timeout);
        var msg = err.name === 'AbortError'
          ? (currentLang === 'es' ? 'Tiempo agotado. Inténtalo de nuevo.' : 'Request timed out. Please try again.')
          : (currentLang === 'es' ? 'Error al enviar. Inténtalo de nuevo.' : 'Send failed. Please try again.');
        if (statusDiv) { statusDiv.textContent = msg; statusDiv.className = 'form-status error'; }
        if (btn) { btn.style.background = '#ef4444'; }
        setTimeout(function () {
          if (btn) { btn.textContent = origText; btn.style.background = ''; btn.disabled = false; }
          if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = 'form-status'; }
        }, 3000);
      }
    });
  }

  /* ═══════════════════════════════════════════════
   * SECTION: CV download button — language-aware dual CV
   * ═══════════════════════════════════════════════ */
  var cvBtn = document.getElementById('cvBtn');
  var cvDisabled = false;

  /**
   * Language → filename map.
   * Replace CV_EN.pdf with the real English CV when available.
   */
  var CV_FILES = { es: 'CV_ES.pdf', en: 'CV_EN.pdf' };

  /**
   * Update CV button href/download to match the active language,
   * or show a "coming soon" label when the file is unavailable.
   */
  function updateCvBtnText() {
    if (!cvBtn) return;
    var cvSpan = cvBtn.querySelector('[data-es][data-en]');

    if (cvDisabled) {
      /* File unavailable — update label text only, keep SVG icon intact */
      var disabledLabel = currentLang === 'es' ? 'CV próximamente' : 'CV coming soon';
      if (cvSpan) {
        cvSpan.setAttribute('data-es', 'CV próximamente');
        cvSpan.setAttribute('data-en', 'CV coming soon');
        cvSpan.textContent = disabledLabel;
      } else {
        cvBtn.textContent = disabledLabel;
      }
      return;
    }

    /* Update href and download filename to match active language */
    var cvFile = CV_FILES[currentLang] || CV_FILES.es;
    cvBtn.href = cvFile;
    cvBtn.setAttribute('download', cvFile);
    /* Label is already updated by the main [data-es][data-en] loop,
       but sync it explicitly here too for robustness. */
    if (cvSpan) {
      cvSpan.textContent = cvSpan.getAttribute('data-' + currentLang) || cvSpan.textContent;
    }
  }

  if (cvBtn) {
    fetch(CV_FILES.es, { method: 'HEAD' }).then(function (res) {
      if (!res.ok) {
        cvDisabled = true;
        cvBtn.classList.add('disabled');
        cvBtn.setAttribute('aria-disabled', 'true');
        cvBtn.removeAttribute('download');
        cvBtn.addEventListener('click', function (e) { e.preventDefault(); });
        updateCvBtnText();
      }
    }).catch(function () {
      cvDisabled = true;
      cvBtn.classList.add('disabled');
      cvBtn.setAttribute('aria-disabled', 'true');
      cvBtn.removeAttribute('download');
      cvBtn.addEventListener('click', function (e) { e.preventDefault(); });
      updateCvBtnText();
    });

  }

  /* ═══════════════════════════════════════════════
   * SECTION: Initial dynamic experience years update
   * ═══════════════════════════════════════════════ */
  updateExpYears();

  /* Apply saved language on load */
  if (currentLang !== 'es') applyLang();

})();
