/* ==========================================================================
   JESUS CHRONICLES — CORE ENGINE
   Vanilla JavaScript / HTML5 / CSS3
   Architecture: Controller + State + Event Bus + Managers
   ========================================================================== */
(() => {
  'use strict';

  const VERSION = '1.0.0';
  const SAVE_KEY = 'jesus-chronicles:save:v1';
  const SETTINGS_KEY = 'jesus-chronicles:settings:v1';
  const AUTOSAVE_DELAY = 650;

  const clamp = (value, min = 0, max = 100) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  };

  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const nowISO = () => new Date().toISOString();
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = (id) => document.getElementById(id);
  const safeText = (value) => String(value ?? '');

  const formatDate = (iso) => {
    if (!iso) return 'Nenhum registro';

    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(iso));
    } catch {
      return 'Registro existente';
    }
  };

  /* ========================================================================
     EVENT BUS
     ======================================================================== */

  class EventBus {
    constructor(logger) {
      this.logger = logger;
      this.events = new Map();
    }

    on(name, fn) {
      if (!this.events.has(name)) {
        this.events.set(name, new Set());
      }

      this.events.get(name).add(fn);

      return () => this.off(name, fn);
    }

    off(name, fn) {
      this.events.get(name)?.delete(fn);
    }

    emit(name, payload) {
      this.logger?.trackEvent(name, payload);

      for (const fn of this.events.get(name) ?? []) {
        try {
          fn(payload);
        } catch (error) {
          this.logger?.error(`Evento ${name}`, error);
        }
      }
    }
  }

  /* ========================================================================
     LOGGER / DIAGNÓSTICO
     ======================================================================== */

  class GameLogger {
    constructor() {
      this.entries = [];
      this.max = 160;

      this.eventCount = 0;
      this.mutationCount = 0;
      this.observerCount = 0;

      this.lastFlow = {
        event: '—',
        function: '—',
        state: '—',
        dom: '—',
        result: '—'
      };
    }

    push(level, message, detail = '') {
      this.entries.push({
        time: new Date().toLocaleTimeString('pt-BR'),
        level,
        message,
        detail: safeText(detail)
      });

      if (this.entries.length > this.max) {
        this.entries.splice(0, this.entries.length - this.max);
      }

      if (level === 'error') {
        console.error('[JC]', message, detail);
      } else if (level === 'warn') {
        console.warn('[JC]', message, detail);
      } else {
        console.info('[JC]', message, detail);
      }
    }

    info(message, detail) {
      this.push('info', message, detail);
    }

    warn(message, detail) {
      this.push('warn', message, detail);
    }

    error(message, error) {
      this.push(
        'error',
        message,
        error?.stack || error?.message || error
      );
    }

    trackEvent(name, payload) {
      this.eventCount += 1;
      this.lastFlow.event = name;
      this.lastFlow.result =
        payload?.id ||
        payload?.source ||
        'ok';
    }

    mutation(path, source) {
      this.mutationCount += 1;

      this.lastFlow.function =
        source ||
        'state.patch';

      this.lastFlow.state = path;
      this.lastFlow.dom = 'render';
    }

    clear() {
      this.entries.length = 0;
    }
  }

  /* ========================================================================
     ESTADO PADRÃO
     ======================================================================== */

  const DEFAULT_STATE = {
    version: VERSION,

    phase: 'title',

    meta: {
      createdAt: null,
      updatedAt: null,
      playSeconds: 0,
      lastAutosave: null
    },

    player: {
      name: 'O PROTAGONISTA',
      role: 'Viajante temporal',
      portrait: '01',

      stats: {
        hope: 45,
        freedom: 40,
        control: 55,
        temporal: 100
      },

      abilities: [
        {
          id: 'observe',
          name: 'Leitura de contexto',
          description:
            'Percebe detalhes históricos e sociais.',
          unlocked: true
        },
        {
          id: 'anchor',
          name: 'Âncora temporal',
          description:
            'Reduz instabilidade após decisões críticas.',
          unlocked: true
        },
        {
          id: 'empathy',
          name: 'Escuta ativa',
          description:
            'Abre opções de diálogo baseadas em esperança.',
          unlocked: false
        }
      ]
    },

    world: {
      location: 'mega_city',
      discovered: ['mega_city'],
      visited: ['mega_city'],
      inspectCount: 0,
      era: 'FUTURO',
      act: 'PRÓLOGO'
    },

    narrative: {
      cinematicIndex: 0,
      currentScene: 'g_intro',
      act: 1,
      flags: {},
      choices: [],
      seenScenes: [],
      ending: null
    },

    missions: {
      intro: {
        id: 'intro',
        title: 'Entenda a missão',
        description:
          'Investigue a instalação e descubra por que você foi escolhido.',
        status: 'active',
        progress: 0,
        goal: 2
      },

      responsibility: {
        id: 'responsibility',
        title: 'O peso da escolha',
        description:
          'Tome decisões sem transferir toda a responsabilidade para o passado.',
        status: 'locked',
        progress: 0,
        goal: 3
      },

      truth: {
        id: 'truth',
        title: 'O que realmente aconteceu',
        description:
          'Reconstrua o motivo da crise temporal.',
        status: 'locked',
        progress: 0,
        goal: 3
      }
    },

    codex: {
      future: {
        id: 'future',
        title: 'O Futuro',
        category: 'Mundo',
        text:
          'Uma civilização tecnicamente avançada que normalizou crises permanentes.',
        unlocked: true
      },

      project: {
        id: 'project',
        title: 'Projeto Cronos',
        category: 'Organização',
        text:
          'Programa experimental de deslocamento temporal.',
        unlocked: false
      },

      paradox: {
        id: 'paradox',
        title: 'Paradoxo de Responsabilidade',
        category: 'Teoria',
        text:
          'Quanto mais o presente tenta terceirizar suas escolhas, mais instável se torna a linha temporal.',
        unlocked: false
      },

      archive: {
        id: 'archive',
        title: 'Arquivo de Ruptura',
        category: 'História',
        text:
          'Registros censurados sobre a origem da crise global.',
        unlocked: false
      }
    },

    settings: {
      fastText: false,
      highContrast: false,
      reducedMotion: false,
      audio: true
    },

    statistics: {
      choices: 0,
      dialogues: 0,
      inspections: 0,
      saves: 0,
      sceneChanges: 0
    }
  };

  /* ========================================================================
     STATE MANAGER
     ======================================================================== */

  class StateManager {
    constructor(bus, logger) {
      this.bus = bus;
      this.logger = logger;
      this.state = deepClone(DEFAULT_STATE);
    }

    snapshot() {
      return deepClone(this.state);
    }

    reset(preserveSettings = true) {
      const settings = preserveSettings
        ? deepClone(this.state.settings)
        : deepClone(DEFAULT_STATE.settings);

      this.state = deepClone(DEFAULT_STATE);

      this.state.settings = settings;
      this.state.meta.createdAt = nowISO();
      this.state.meta.updatedAt = nowISO();

      this.bus.emit(
        'state:reset',
        this.snapshot()
      );

      return this.state;
    }

    replace(next, source = 'load') {
      this.state = this.sanitize(next);

      this.logger.mutation('*', source);

      this.bus.emit('state:changed', {
        path: '*',
        source,
        state: this.snapshot()
      });
    }

    get(path = '') {
      if (!path) {
        return this.state;
      }

      return path
        .split('.')
        .reduce(
          (obj, key) => obj?.[key],
          this.state
        );
    }

    set(path, value, source = 'unknown') {
      const keys = path.split('.');
      let cursor = this.state;

      for (
        let i = 0;
        i < keys.length - 1;
        i += 1
      ) {
        const key = keys[i];

        if (
          !cursor[key] ||
          typeof cursor[key] !== 'object'
        ) {
          cursor[key] = {};
        }

        cursor = cursor[key];
      }

      const last = keys.at(-1);

      const before =
        deepClone(cursor[last]);

      cursor[last] = value;

      this.state.meta.updatedAt =
        nowISO();

      this.logger.mutation(
        path,
        source
      );

      this.bus.emit(
        'state:changed',
        {
          path,
          before,
          value: deepClone(value),
          source
        }
      );
    }

    patch(
      path,
      partial,
      source = 'unknown'
    ) {
      const base = this.get(path);

      this.set(
        path,
        {
          ...(base || {}),
          ...partial
        },
        source
      );
    }

    increment(
      path,
      amount = 1,
      source = 'increment'
    ) {
      this.set(
        path,
        (Number(this.get(path)) || 0) +
          amount,
        source
      );
    }

    adjustStat(
      key,
      amount,
      source = 'narrative'
    ) {
      const path =
        `player.stats.${key}`;

      this.set(
        path,
        clamp(
          (this.get(path) || 0) +
            amount
        ),
        source
      );
    }

    sanitize(input) {
      const merged =
        deepClone(DEFAULT_STATE);

      const merge = (
        target,
        src
      ) => {
        if (
          !src ||
          typeof src !== 'object'
        ) {
          return target;
        }

        for (
          const [key, val]
          of Object.entries(src)
        ) {
          if (Array.isArray(val)) {
            target[key] =
              deepClone(val);
          } else if (
            val &&
            typeof val === 'object'
          ) {
            target[key] = merge(
              target[key] &&
              typeof target[key] ===
                'object'
                ? target[key]
                : {},
              val
            );
          } else {
            target[key] = val;
          }
        }

        return target;
      };

      const out =
        merge(merged, input);

      for (
        const key
        of [
          'hope',
          'freedom',
          'control',
          'temporal'
        ]
      ) {
        out.player.stats[key] =
          clamp(
            out.player.stats[key]
          );
      }

      out.version = VERSION;

      return out;
    }
  }

  /* ========================================================================
     ÁUDIO — WEB AUDIO API
     ======================================================================== */

  class AudioManager {
    constructor(state, logger) {
      this.state = state;
      this.logger = logger;
      this.ctx = null;
      this.master = null;
    }

    ensure() {
      if (
        !this.state.get(
          'settings.audio'
        )
      ) {
        return false;
      }

      try {
        const AudioCtx =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioCtx) {
          return false;
        }

        if (!this.ctx) {
          this.ctx =
            new AudioCtx();

          this.master =
            this.ctx.createGain();

          this.master.gain.value =
            0.08;

          this.master.connect(
            this.ctx.destination
          );
        }

        if (
          this.ctx.state ===
          'suspended'
        ) {
          this.ctx.resume();
        }

        return true;
      } catch (error) {
        this.logger.warn(
          'Áudio indisponível',
          error.message
        );

        return false;
      }
    }

    tone(
      freq = 440,
      duration = 0.06,
      type = 'sine',
      volume = 0.35,
      delay = 0
    ) {
      if (!this.ensure()) {
        return;
      }

      const t =
        this.ctx.currentTime +
        delay;

      const osc =
        this.ctx.createOscillator();

      const gain =
        this.ctx.createGain();

      osc.type = type;

      osc.frequency.setValueAtTime(
        freq,
        t
      );

      gain.gain.setValueAtTime(
        0.0001,
        t
      );

      gain.gain
        .exponentialRampToValueAtTime(
          Math.max(
            0.001,
            volume
          ),
          t + 0.01
        );

      gain.gain
        .exponentialRampToValueAtTime(
          0.0001,
          t + duration
        );

      osc.connect(gain);
      gain.connect(this.master);

      osc.start(t);

      osc.stop(
        t +
          duration +
          0.02
      );
    }

    click() {
      this.tone(
        520,
        0.045,
        'triangle',
        0.22
      );
    }

    confirm() {
      this.tone(
        420,
        0.08,
        'sine',
        0.23
      );

      this.tone(
        660,
        0.12,
        'sine',
        0.18,
        0.05
      );
    }

    alert() {
      this.tone(
        160,
        0.16,
        'sawtooth',
        0.16
      );
    }

    choice() {
      this.tone(
        300,
        0.06,
        'triangle',
        0.22
      );

      this.tone(
        480,
        0.09,
        'triangle',
        0.18,
        0.045
      );
    }
  }

  /* ========================================================================
     SAVE MANAGER
     ======================================================================== */

  class SaveManager {
    constructor(
      state,
      bus,
      logger,
      notify
    ) {
      this.state = state;
      this.bus = bus;
      this.logger = logger;
      this.notify = notify;
      this.timer = null;
    }

    hasSave() {
      try {
        return !!localStorage.getItem(
          SAVE_KEY
        );
      } catch {
        return false;
      }
    }

    readRaw() {
      try {
        return JSON.parse(
          localStorage.getItem(
            SAVE_KEY
          ) || 'null'
        );
      } catch (error) {
        this.logger.error(
          'Save corrompido',
          error
        );

        return null;
      }
    }

    migrate(payload) {
      if (!payload) {
        return null;
      }

      if (payload.state) {
        return {
          ...payload,
          version: VERSION,
          state:
            this.state.sanitize(
              payload.state
            )
        };
      }

      return {
        version: VERSION,
        timestamp:
          payload.timestamp ||
          nowISO(),
        state:
          this.state.sanitize(
            payload
          )
      };
    }

    save({
      silent = false,
      autosave = false
    } = {}) {
      try {
        this.state.increment(
          'statistics.saves',
          1,
          autosave
            ? 'autosave'
            : 'save'
        );

        if (autosave) {
          this.state.set(
            'meta.lastAutosave',
            nowISO(),
            'autosave'
          );
        }

        const payload = {
          version: VERSION,
          timestamp: nowISO(),
          checksum: 'JC-V1',
          state:
            this.state.snapshot()
        };

        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify(payload)
        );

        this.bus.emit(
          'save:completed',
          payload
        );

        if (!silent) {
          this.notify(
            'Crônica salva',
            autosave
              ? 'Salvamento automático concluído.'
              : 'Seu progresso foi armazenado neste navegador.',
            'success'
          );
        }

        return true;
      } catch (error) {
        this.logger.error(
          'Falha ao salvar',
          error
        );

        if (!silent) {
          this.notify(
            'Falha ao salvar',
            'O navegador bloqueou o armazenamento local.',
            'error'
          );
        }

        return false;
      }
    }

    schedule() {
      clearTimeout(this.timer);

      this.timer =
        setTimeout(
          () =>
            this.save({
              silent: true,
              autosave: true
            }),
          AUTOSAVE_DELAY
        );
    }

    load({
      silent = false
    } = {}) {
      try {
        const raw =
          this.readRaw();

        const payload =
          this.migrate(raw);

        if (!payload?.state) {
          throw new Error(
            'Nenhum save válido encontrado.'
          );
        }

        this.state.replace(
          payload.state,
          'save.load'
        );

        this.bus.emit(
          'save:loaded',
          payload
        );

        if (!silent) {
          this.notify(
            'Crônica restaurada',
            `Save de ${formatDate(
              payload.timestamp
            )}.`,
            'success'
          );
        }

        return true;
      } catch (error) {
        this.logger.error(
          'Falha ao carregar save',
          error
        );

        if (!silent) {
          this.notify(
            'Não foi possível carregar',
            'O save está ausente ou inválido. Uma nova crônica continua disponível.',
            'error'
          );
        }

        return false;
      }
    }

    delete() {
      try {
        localStorage.removeItem(
          SAVE_KEY
        );

        this.bus.emit(
          'save:deleted'
        );

        this.notify(
          'Save apagado',
          'A crônica local foi removida.',
          'warning'
        );

        return true;
      } catch (error) {
        this.logger.error(
          'Falha ao apagar save',
          error
        );

        return false;
      }
    }
  }

  /* ========================================================================
     MUNDO
     ======================================================================== */

  const LOCATIONS = {
    mega_city: {
      name: 'Megacidade',
      act: 'PRÓLOGO',
      era: 'FUTURO',
      tag: 'ZONA DE CONFLITO',
      description:
        'Região parcialmente funcional sobre uma área devastada.',
      interaction:
        'Explorar área'
    },

    chrono_lab: {
      name: 'Complexo Cronos',
      act: 'ATO I',
      era: 'FUTURO',
      tag: 'SETOR RESTRITO',
      description:
        'O maior experimento temporal já construído pulsa sob toneladas de concreto.',
      interaction:
        'Examinar o núcleo temporal'
    },

    archive: {
      name: 'Arquivo de Ruptura',
      act: 'ATO I',
      era: 'FUTURO',
      tag: 'ARQUIVO CENSURADO',
      description:
        'Relatórios antigos contradizem a versão oficial da missão.',
      interaction:
        'Ler registros ocultos'
    },

    transit: {
      name: 'Corredor de Salto',
      act: 'ATO II',
      era: 'ENTRE ERAS',
      tag: 'INSTABILIDADE',
      description:
        'O espaço perde profundidade. Memórias e possibilidades aparecem como ruído.',
      interaction:
        'Estabilizar coordenadas'
    },

    galilee: {
      name: 'Galileia',
      act: 'ATO II',
      era: 'SÉCULO I',
      tag: 'LINHA HISTÓRICA',
      description:
        'O passado não parece um arquivo. Parece vivo — e não espera por você.',
      interaction:
        'Observar antes de interferir'
    }
  };

  /* ========================================================================
     CINEMÁTICAS
     ======================================================================== */

  const CINEMATICS = [
    {
      title:
        'O MUNDO DESTRUÍDO',
      text:
        'No fim do século XXI, a humanidade não chegou ao apocalipse de uma só vez. Ela chegou em pequenas decisões, repetidas por décadas, até que viver em crise se tornou normal.'
    },

    {
      title:
        'UMA SOLUÇÃO IMPOSSÍVEL',
      text:
        'Governos ruíram. Recursos tornaram-se instrumentos de controle. Então surgiu o Projeto Cronos: não uma máquina para consertar o passado, mas para pedir ao passado uma resposta.'
    },

    {
      title:
        'A HIPÓTESE',
      text:
        'Se a humanidade pudesse encontrar Jesus antes que a história o transformasse em símbolo, talvez pudesse trazer ao futuro uma orientação capaz de unir o que restou.'
    },

    {
      title:
        'O VOLUNTÁRIO',
      text:
        'Você foi escolhido porque sobreviveu à guerra, conhece sistemas antigos e, segundo os avaliadores, ainda consegue acreditar que escolhas individuais importam.'
    },

    {
      title:
        'A REGRA',
      text:
        'A viagem não permite mudanças ilimitadas. Cada interferência cobra estabilidade temporal. E a máquina registra não só o que você faz — mas por que fez.'
    },

    {
      title:
        'A PERGUNTA',
      text:
        'A missão oficial é simples: encontre Jesus e peça ajuda para salvar o mundo. A pergunta que ninguém quer responder é outra: e se o futuro estiver procurando um salvador apenas para evitar mudar a si mesmo?'
    }
  ];

  /* ========================================================================
     CENAS
     ======================================================================== */

  const SCENES = {
    g_intro: {
      speaker:
        'PROTOCOLO CRONOLÓGICO',

      role:
        'SISTEMA',

      type:
        'NARRAÇÃO',

      location:
        'mega_city',

      text:
        'A autorização final foi emitida. Antes do salto, você tem acesso à zona externa e ao Complexo Cronos. Observe o mundo que a missão pretende salvar.',

      next:
        'g_city_choice'
    },

    g_city_choice: {
      speaker:
        'DRA. MIRELA VOSS',

      role:
        'DIRETORA DO PROJETO',

      type:
        'DIÁLOGO',

      location:
        'mega_city',

      text:
        'Não precisamos que você julgue o presente. Precisamos que encontre uma resposta no passado. Está claro?',

      choices: [
        {
          id:
            'obey',

          text:
            '“Está claro. Eu cumpro a missão.”',

          effects: {
            control: 8,
            freedom: -2
          },

          flags: {
            obedient: true
          },

          next:
            'g_lab'
        },

        {
          id:
            'question',

          text:
            '“E se a resposta não estiver no passado?”',

          effects: {
            hope: 5,
            freedom: 8,
            control: -4
          },

          flags: {
            questionedMission:
              true
          },

          codex:
            'paradox',

          next:
            'g_lab'
        },

        {
          id:
            'silence',

          text:
            'Permanecer em silêncio.',

          effects: {
            control: -2,
            temporal: 1
          },

          flags: {
            silentOpening: true
          },

          next:
            'g_lab'
        }
      ]
    },

    g_lab: {
      speaker:
        'DRA. MIRELA VOSS',

      role:
        'DIRETORA DO PROJETO',

      type:
        'DIÁLOGO',

      location:
        'chrono_lab',

      text:
        'O núcleo está em 97%. Você terá uma janela limitada. Antes de entrar, há um arquivo que o Conselho preferia que você não visse.',

      onEnter: {
        missionProgress: [
          'intro',
          1
        ],

        codex:
          'project'
      },

      next:
        'g_archive_choice'
    },

    g_archive_choice: {
      speaker:
        'SISTEMA DE ARQUIVOS',

      role:
        'RESTRITO',

      type:
        'DECISÃO',

      location:
        'archive',

      text:
        'Acesso não autorizado detectado. O arquivo “RUPTURA-00” contém registros anteriores ao Projeto Cronos. Abrir pode atrasar o lançamento.',

      choices: [
        {
          id:
            'open_archive',

          text:
            'Abrir o arquivo mesmo assim.',

          effects: {
            freedom: 7,
            control: -5,
            temporal: -2
          },

          flags: {
            archiveOpened: true
          },

          codex:
            'archive',

          missionProgress: [
            'truth',
            1
          ],

          next:
            'g_archive_reveal'
        },

        {
          id:
            'ignore_archive',

          text:
            'Ignorar e seguir o protocolo.',

          effects: {
            control: 7,
            hope: -2
          },

          flags: {
            archiveIgnored: true
          },

          next:
            'g_jump'
        }
      ]
    },

    g_archive_reveal: {
      speaker:
        'ARQUIVO RUPTURA-00',

      role:
        'REGISTRO HISTÓRICO',

      type:
        'NARRAÇÃO',

      location:
        'archive',

      text:
        '“A crise não começou com falta de tecnologia. Começou quando instituições perceberam que o medo tornava populações mais fáceis de administrar.” O relatório termina com páginas removidas.',

      onEnter: {
        missionUnlock:
          'truth'
      },

      next:
        'g_jump'
    },

    g_jump: {
      speaker:
        'PROTOCOLO CRONOLÓGICO',

      role:
        'SISTEMA',

      type:
        'ALERTA',

      location:
        'transit',

      text:
        'SALTO INICIADO. Coordenadas históricas adquiridas. A estabilidade está oscilando. Concentre-se em uma lembrança que defina por que você quer salvar o futuro.',

      choices: [
        {
          id:
            'memory_people',

          text:
            'As pessoas que ainda tentam ajudar umas às outras.',

          effects: {
            hope: 10,
            temporal: 3
          },

          flags: {
            motivePeople: true
          },

          next:
            'g_arrival'
        },

        {
          id:
            'memory_loss',

          text:
            'Tudo que você perdeu.',

          effects: {
            control: 6,
            hope: -3,
            temporal: -1
          },

          flags: {
            motiveLoss: true
          },

          next:
            'g_arrival'
        },

        {
          id:
            'memory_choice',

          text:
            'A chance de provar que o futuro ainda pode escolher diferente.',

          effects: {
            freedom: 10,
            hope: 4
          },

          flags: {
            motiveChoice: true
          },

          next:
            'g_arrival'
        }
      ]
    },

    g_arrival: {
      speaker:
        'PROTOCOLO CRONOLÓGICO',

      role:
        'SISTEMA',

      type:
        'NARRAÇÃO',

      location:
        'galilee',

      text:
        'Deslocamento concluído. O ar é quente, o chão é irregular e não existe interface separando você da história. Pela primeira vez, o passado não parece distante.',

      onEnter: {
        missionProgress: [
          'intro',
          1
        ],

        missionComplete:
          'intro',

        missionUnlock:
          'responsibility'
      },

      next:
        'g_first_witness'
    },

    g_first_witness: {
      speaker:
        'VIAJANTE DESCONHECIDO',

      role:
        'MORADOR LOCAL',

      type:
        'DIÁLOGO',

      location:
        'galilee',

      text:
        'Você está perdido? Suas roupas... nunca vi tecido assim. Se procura alguém, talvez seja melhor começar perguntando quem você é.',

      choices: [
        {
          id:
            'tell_truth',

          text:
            '“Sou alguém de muito longe procurando respostas.”',

          effects: {
            hope: 5,
            freedom: 5
          },

          flags: {
            honestStranger:
              true
          },

          missionProgress: [
            'responsibility',
            1
          ],

          next:
            'g_open_end'
        },

        {
          id:
            'lie_safe',

          text:
            '“Sou mercador. Só estou de passagem.”',

          effects: {
            control: 6,
            temporal: -2
          },

          flags: {
            liedStranger: true
          },

          missionProgress: [
            'responsibility',
            1
          ],

          next:
            'g_open_end'
        }
      ]
    },

    g_open_end: {
      speaker:
        'NARRADOR',

      role:
        'CRÔNICA',

      type:
        'NARRAÇÃO',

      location:
        'galilee',

      text:
        'A busca começou. Mas a primeira mudança importante talvez já tenha acontecido: você entrou na história acreditando que veio encontrar uma resposta — e encontrou uma pergunta.',

      next:
        'g_open_end'
    }
  };

  /* ========================================================================
     MISSION MANAGER
     ======================================================================== */

  class MissionManager {
    constructor(
      state,
      bus,
      notify
    ) {
      this.state = state;
      this.bus = bus;
      this.notify = notify;
    }

    unlock(id) {
      const mission =
        this.state.get(
          `missions.${id}`
        );

      if (
        !mission ||
        mission.status !==
          'locked'
      ) {
        return;
      }

      this.state.patch(
        `missions.${id}`,
        {
          status: 'active'
        },
        'mission.unlock'
      );

      this.notify(
        'Nova missão',
        mission.title,
        'info'
      );

      this.bus.emit(
        'mission:updated',
        {
          id,
          type: 'unlock'
        }
      );
    }

    progress(
      id,
      amount = 1
    ) {
      const mission =
        this.state.get(
          `missions.${id}`
        );

      if (
        !mission ||
        ![
          'active',
          'available'
        ].includes(
          mission.status
        )
      ) {
        return;
      }

      const progress =
        Math.min(
          mission.goal,
          (mission.progress || 0) +
            amount
        );

      this.state.patch(
        `missions.${id}`,
        {
          progress,
          status: 'active'
        },
        'mission.progress'
      );

      if (
        progress >= mission.goal
      ) {
        this.complete(id);
      } else {
        this.bus.emit(
          'mission:updated',
          {
            id,
            type: 'progress'
          }
        );
      }
    }
        complete(id) {
      const mission =
        this.state.get(
          `missions.${id}`
        );

      if (
        !mission ||
        mission.status ===
          'completed'
      ) {
        return;
      }

      this.state.patch(
        `missions.${id}`,
        {
          progress:
            mission.goal,
          status:
            'completed'
        },
        'mission.complete'
      );

      this.notify(
        'Missão concluída',
        mission.title,
        'success'
      );

      this.bus.emit(
        'mission:updated',
        {
          id,
          type: 'complete'
        }
      );
    }

    active() {
      return Object.values(
        this.state.get(
          'missions'
        )
      ).filter(
        (mission) =>
          mission.status ===
          'active'
      );
    }
  }

  /* ========================================================================
     CODEX MANAGER
     ======================================================================== */

  class CodexManager {
    constructor(
      state,
      bus,
      notify
    ) {
      this.state = state;
      this.bus = bus;
      this.notify = notify;
    }

    unlock(id) {
      const entry =
        this.state.get(
          `codex.${id}`
        );

      if (
        !entry ||
        entry.unlocked
      ) {
        return;
      }

      this.state.patch(
        `codex.${id}`,
        {
          unlocked: true
        },
        'codex.unlock'
      );

      this.notify(
        'Códex atualizado',
        entry.title,
        'info'
      );

      this.bus.emit(
        'codex:updated',
        {
          id
        }
      );
    }

    unlocked() {
      return Object.values(
        this.state.get(
          'codex'
        )
      ).filter(
        (entry) =>
          entry.unlocked
      );
    }
  }

  /* ========================================================================
     PARTICULAS
     ======================================================================== */

  class ParticleSystem {
    constructor(state) {
      this.state = state;

      this.container =
        byId(
          'backgroundParticles'
        );

      this.timer = null;
    }

    init() {
      if (
        !this.container ||
        this.timer
      ) {
        return;
      }

      const spawn = () => {
        if (
          this.state.get(
            'settings.reducedMotion'
          ) ||
          document.hidden
        ) {
          return;
        }

        if (
          this.container
            .childElementCount >
          28
        ) {
          return;
        }

        const particle =
          document.createElement(
            'i'
          );

        particle.className =
          'jc-particle';

        particle.style.setProperty(
          '--x',
          `${Math.random() *
            100}%`
        );

        particle.style.setProperty(
          '--size',
          `${
            1 +
            Math.random() * 2.5
          }px`
        );

        particle.style.setProperty(
          '--dur',
          `${
            7 +
            Math.random() * 10
          }s`
        );

        particle.style.setProperty(
          '--delay',
          `${-Math.random() *
            3}s`
        );

        this.container.appendChild(
          particle
        );

        particle.addEventListener(
          'animationend',
          () =>
            particle.remove(),
          {
            once: true
          }
        );
      };

      for (
        let i = 0;
        i < 16;
        i += 1
      ) {
        spawn();
      }

      this.timer =
        setInterval(
          spawn,
          700
        );
    }
  }

  /* ========================================================================
     UI MANAGER
     ======================================================================== */

  class UIManager {
    constructor(
      state,
      bus,
      logger,
      audio
    ) {
      this.state = state;
      this.bus = bus;
      this.logger = logger;
      this.audio = audio;

      this.initialized = false;

      this.bound =
        new WeakSet();

      this.openOverlays =
        new Set();

      this.notify =
        this.notify.bind(this);
    }

    el(id) {
      return byId(id);
    }

    bind(
      el,
      event,
      fn,
      options
    ) {
      if (!el) {
        this.logger.warn(
          `Elemento ausente para evento ${event}`
        );

        return;
      }

      const key =
        `${event}:${
          fn.name ||
          'anon'
        }`;

      el.__jcBindings ??=
        new Set();

      if (
        el.__jcBindings.has(
          key
        )
      ) {
        return;
      }

      el.addEventListener(
        event,
        fn,
        options
      );

      el.__jcBindings.add(
        key
      );
    }

    showScreen(id) {
      qsa('.screen').forEach(
        (screen) => {
          screen.classList.toggle(
            'active',
            screen.id === id
          );
        }
      );

      this.state.set(
        'phase',
        id === 'screenTitle'
          ? 'title'
          : id ===
              'screenCinematic'
            ? 'cinematic'
            : 'game',
        'ui.showScreen'
      );

      this.bus.emit(
        'screen:changed',
        {
          id
        }
      );
    }

    openOverlay(id) {
      const el =
        this.el(id);

      if (!el) {
        return;
      }

      el.hidden = false;

      requestAnimationFrame(
        () =>
          el.classList.add(
            'active'
          )
      );

      this.openOverlays.add(
        id
      );

      this.audio.click();

      this.bus.emit(
        'overlay:opened',
        {
          id
        }
      );

      qs(
        'button, input, [tabindex]',
        el
      )?.focus({
        preventScroll: true
      });
    }

    closeOverlay(id) {
      const el =
        this.el(id);

      if (!el) {
        return;
      }

      el.classList.remove(
        'active'
      );

      this.openOverlays.delete(
        id
      );

      const finish = () => {
        if (
          !el.classList.contains(
            'active'
          )
        ) {
          el.hidden = true;
        }
      };

      setTimeout(
        finish,
        this.state.get(
          'settings.reducedMotion'
        )
          ? 0
          : 180
      );

      this.bus.emit(
        'overlay:closed',
        {
          id
        }
      );
    }

    closeTopOverlay() {
      const id =
        [
          ...this.openOverlays
        ].at(-1);

      if (id) {
        this.closeOverlay(id);
      }

      return !!id;
    }

    transition(callback) {
      const fade =
        this.el(
          'fadeTransition'
        );

      if (
        !fade ||
        this.state.get(
          'settings.reducedMotion'
        )
      ) {
        callback();
        return;
      }

      fade.classList.add(
        'active'
      );

      setTimeout(
        () => {
          callback();

          setTimeout(
            () =>
              fade.classList.remove(
                'active'
              ),
            80
          );
        },
        220
      );
    }

    notify(
      title,
      message = '',
      type = 'info'
    ) {
      const stack =
        this.el(
          'notificationStack'
        );

      if (!stack) {
        return;
      }

      const item =
        document.createElement(
          'div'
        );

      item.className =
        `notification notification-${type}`;

      item.innerHTML =
        `<strong>${this.escape(
          title
        )}</strong>` +
        `<span>${this.escape(
          message
        )}</span>`;

      stack.appendChild(
        item
      );

      requestAnimationFrame(
        () =>
          item.classList.add(
            'show'
          )
      );

      setTimeout(
        () => {
          item.classList.remove(
            'show'
          );

          setTimeout(
            () =>
              item.remove(),
            220
          );
        },
        3400
      );
    }

    escape(value) {
      const div =
        document.createElement(
          'div'
        );

      div.textContent =
        safeText(value);

      return div.innerHTML;
    }

    render() {
      const state =
        this.state.get();

      this.renderStats();
      this.renderAbilities();
      this.renderWorld();
      this.renderMissions();
      this.renderCodex();
      this.renderSettings();
      this.renderSaveStatus();

      const name =
        this.el(
          'playerNameDisplay'
        );

      if (name) {
        name.textContent =
          state.player.name;
      }

      const role =
        this.el(
          'playerRoleDisplay'
        );

      if (role) {
        role.textContent =
          state.player.role;
      }

      const phase =
        this.el(
          'phaseLabel'
        );

      if (phase) {
        phase.textContent =
          state.phase === 'game'
            ? `ATO ${state.narrative.act}`
            : state.phase.toUpperCase();
      }

      const continueButton =
        this.el(
          'continueButton'
        );

      if (continueButton) {
        continueButton.classList.toggle(
          'hidden',
          !window.game?.save?.hasSave()
        );
      }

      document.body.classList.toggle(
        'high-contrast',
        !!state.settings
          .highContrast
      );

      document.body.classList.toggle(
        'reduced-motion',
        !!state.settings
          .reducedMotion
      );
    }

    renderStats() {
      const map = {
        hope: [
          'hopeBar',
          'hopeValue'
        ],

        freedom: [
          'freedomBar',
          'freedomValue'
        ],

        control: [
          'controlBar',
          'controlValue'
        ],

        temporal: [
          'temporalBar',
          'temporalValue'
        ]
      };

      for (
        const [
          key,
          [
            barId,
            valueId
          ]
        ]
        of Object.entries(
          map
        )
      ) {
        const value =
          clamp(
            this.state.get(
              `player.stats.${key}`
            )
          );

        const bar =
          this.el(barId);

        const label =
          this.el(valueId);

        if (bar) {
          bar.style.width =
            `${value}%`;

          bar.setAttribute(
            'aria-valuenow',
            value
          );
        }

        if (label) {
          label.textContent =
            Math.round(value);
        }
      }
    }

    renderAbilities() {
      const list =
        this.el(
          'abilityList'
        );

      if (!list) {
        return;
      }

      list.replaceChildren(
        ...this.state
          .get(
            'player.abilities'
          )
          .map(
            (ability) => {
              const div =
                document.createElement(
                  'div'
                );

              div.className =
                `ability-item ${
                  ability.unlocked
                    ? 'unlocked'
                    : 'locked'
                }`;

              div.innerHTML =
                `<span>${
                  ability.unlocked
                    ? '◆'
                    : '◇'
                }</span>` +
                `<div>` +
                `<strong>${this.escape(
                  ability.name
                )}</strong>` +
                `<small>${this.escape(
                  ability.description
                )}</small>` +
                `</div>`;

              return div;
            }
          )
      );
    }

    renderWorld() {
      const location =
        LOCATIONS[
          this.state.get(
            'world.location'
          )
        ] ||
        LOCATIONS.mega_city;

      [
        [
          'locationAct',
          location.act
        ],
        [
          'locationName',
          location.name
        ],
        [
          'eraValue',
          location.era
        ],
        [
          'sceneTag',
          location.tag
        ],
        [
          'sceneDescription',
          location.description
        ],
        [
          'interactionText',
          location.interaction
        ]
      ].forEach(
        ([id, text]) => {
          const el =
            this.el(id);

          if (el) {
            el.textContent =
              text;
          }
        }
      );

      const scene =
        this.el(
          'worldScene'
        );

      if (scene) {
        scene.dataset.location =
          this.state.get(
            'world.location'
          );
      }
    }

    renderMissions() {
      const list =
        this.el(
          'missionList'
        );

      const detail =
        this.el(
          'questDetailList'
        );

      const missions =
        Object.values(
          this.state.get(
            'missions'
          )
        ).filter(
          (mission) =>
            mission.status !==
            'locked'
        );

      const active =
        missions.filter(
          (mission) =>
            mission.status ===
            'active'
        );

      const count =
        this.el(
          'missionCount'
        );

      if (count) {
        count.textContent =
          active.length;
      }

      const build = (
        mission,
        detailed = false
      ) => {
        const div =
          document.createElement(
            'article'
          );

        div.className =
          `mission-item status-${mission.status}`;

        const percent =
          mission.goal
            ? Math.round(
                (
                  mission.progress /
                  mission.goal
                ) *
                  100
              )
            : 0;

        div.innerHTML =
          `<div class="mission-head">` +
          `<strong>${this.escape(
            mission.title
          )}</strong>` +
          `<span>${
            mission.status ===
            'completed'
              ? 'CONCLUÍDA'
              : `${mission.progress}/${mission.goal}`
          }</span>` +
          `</div>` +
          `${
            detailed
              ? `<p>${this.escape(
                  mission.description
                )}</p>`
              : ''
          }` +
          `<div class="mission-progress">` +
          `<i style="width:${percent}%"></i>` +
          `</div>`;

        return div;
      };

      if (list) {
        list.replaceChildren(
          ...missions
            .slice(0, 4)
            .map(
              (mission) =>
                build(
                  mission
                )
            )
        );
      }

      if (detail) {
        detail.replaceChildren(
          ...missions.map(
            (mission) =>
              build(
                mission,
                true
              )
          )
        );
      }
    }

    renderCodex() {
      const entries =
        Object.values(
          this.state.get(
            'codex'
          )
        ).filter(
          (entry) =>
            entry.unlocked
        );

      const progress =
        this.el(
          'codexProgress'
        );

      if (progress) {
        progress.textContent =
          `${entries.length} de ${
            Object.keys(
              this.state.get(
                'codex'
              )
            ).length
          } registros desbloqueados.`;
      }

      const codexTab =
        this.el(
          'codexTab'
        );

      if (!codexTab) {
        return;
      }

      qsa(
        '.jc-codex-generated',
        codexTab
      ).forEach(
        (node) =>
          node.remove()
      );

      entries.forEach(
        (entry) => {
          const div =
            document.createElement(
              'div'
            );

          div.className =
            'codex-entry jc-codex-generated';

          div.innerHTML =
            `<span class="codex-label">${this.escape(
              entry.category
            )}</span>` +
            `<p>` +
            `<strong>${this.escape(
              entry.title
            )}</strong>` +
            `<br>` +
            `${this.escape(
              entry.text
            )}` +
            `</p>`;

          codexTab.appendChild(
            div
          );
        }
      );
    }

    renderSettings() {
      const map = {
        settingFastText:
          'fastText',

        settingHighContrast:
          'highContrast',

        settingReducedMotion:
          'reducedMotion',

        settingAudio:
          'audio'
      };

      for (
        const [id, key]
        of Object.entries(map)
      ) {
        const el =
          this.el(id);

        if (el) {
          el.checked =
            !!this.state.get(
              `settings.${key}`
            );
        }
      }
    }

    renderSaveStatus() {
      const hasSave =
        window.game?.save
          ?.hasSave?.() ||
        false;

      const payload =
        hasSave
          ? window.game.save.readRaw()
          : null;

      const label =
        hasSave
          ? `Último registro: ${formatDate(
              payload?.timestamp
            )}`
          : 'Nenhum save encontrado';

      [
        'saveCurrentLabel',
        'loadCurrentLabel'
      ].forEach(
        (id) => {
          const el =
            this.el(id);

          if (el) {
            el.textContent =
              label;
          }
        }
      );

      const loadButton =
        this.el(
          'loadGameButton'
        );

      if (loadButton) {
        loadButton.disabled =
          !hasSave;
      }

      const deleteButton =
        this.el(
          'deleteSaveButton'
        );

      if (deleteButton) {
        deleteButton.disabled =
          !hasSave;
      }
    }

    initBindings(game) {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      this.bind(
        this.el(
          'newGameButton'
        ),
        'click',
        () =>
          game.startNewGame()
      );

      this.bind(
        this.el(
          'continueButton'
        ),
        'click',
        () =>
          game.continueGame()
      );

      this.bind(
        this.el(
          'cinematicNext'
        ),
        'click',
        () =>
          game.narrative
            .nextCinematic()
      );

      this.bind(
        this.el(
          'cinematicPrevious'
        ),
        'click',
        () =>
          game.narrative
            .prevCinematic()
      );

      this.bind(
        this.el(
          'dialogueContinueButton'
        ),
        'click',
        () =>
          game.narrative
            .continue()
      );

      this.bind(
        this.el(
          'dialogueSkipButton'
        ),
        'click',
        () =>
          game.narrative
            .skipTyping()
      );

      this.bind(
        this.el(
          'inspectButton'
        ),
        'click',
        () =>
          game.inspect()
      );

      this.bind(
        this.el(
          'questButton'
        ),
        'click',
        () =>
          this.openOverlay(
            'questOverlay'
          )
      );

      this.bind(
        this.el(
          'quickSaveButton'
        ),
        'click',
        () =>
          game.save.save()
      );

      this.bind(
        this.el(
          'menuButton'
        ),
        'click',
        () =>
          this.openOverlay(
            'menuOverlay'
          )
      );

      this.bind(
        this.el(
          'openSaveButton'
        ),
        'click',
        () =>
          this.openOverlay(
            'saveOverlay'
          )
      );

      this.bind(
        this.el(
          'openSettingsButton'
        ),
        'click',
        () =>
          this.openOverlay(
            'settingsOverlay'
          )
      );

      this.bind(
        this.el(
          'menuSave'
        ),
        'click',
        () => {
          this.closeOverlay(
            'menuOverlay'
          );

          this.openOverlay(
            'saveOverlay'
          );
        }
      );

      this.bind(
        this.el(
          'menuSettings'
        ),
        'click',
        () => {
          this.closeOverlay(
            'menuOverlay'
          );

          this.openOverlay(
            'settingsOverlay'
          );
        }
      );

      this.bind(
        this.el(
          'menuCodex'
        ),
        'click',
        () => {
          this.closeOverlay(
            'menuOverlay'
          );

          game.activateSystemTab(
            'codexTab'
          );
        }
      );

      this.bind(
        this.el(
          'menuVisualLab'
        ),
        'click',
        () => {
          this.closeOverlay(
            'menuOverlay'
          );

          this.openOverlay(
            'visualLabOverlay'
          );

          game.visualLab.refresh();
        }
      );

      this.bind(
        this.el(
          'menuRestart'
        ),
        'click',
        () =>
          game.restartToTitle()
      );

      this.bind(
        this.el(
          'saveGameButton'
        ),
        'click',
        () =>
          game.save.save()
      );

      this.bind(
        this.el(
          'loadGameButton'
        ),
        'click',
        () =>
          game.continueGame(
            true
          )
      );

      this.bind(
        this.el(
          'deleteSaveButton'
        ),
        'click',
        () =>
          game.deleteSaveWithConfirm()
      );

      qsa(
        '[data-close-overlay]'
      ).forEach(
        (button) =>
          this.bind(
            button,
            'click',
            () =>
              this.closeOverlay(
                button.dataset
                  .closeOverlay
              )
          )
      );

      qsa(
        '.overlay'
      ).forEach(
        (overlay) =>
          this.bind(
            overlay,
            'mousedown',
            (event) => {
              if (
                event.target ===
                overlay
              ) {
                this.closeOverlay(
                  overlay.id
                );
              }
            }
          )
      );

      qsa(
        '.system-tab'
      ).forEach(
        (button) =>
          this.bind(
            button,
            'click',
            () =>
              game.activateSystemTab(
                button.dataset.tab
              )
          )
      );

      const settingMap = {
        settingFastText:
          'fastText',
        settingHighContrast:
          'highContrast',
        settingReducedMotion:
          'reducedMotion',
        settingAudio:
          'audio'
      };

      Object.entries(
        settingMap
      ).forEach(
        ([id, key]) =>
          this.bind(
            this.el(id),
            'change',
            (event) =>
              game.settings.set(
                key,
                event.target
                  .checked
              )
          )
      );

      this.bind(
        document,
        'keydown',
        (event) =>
          game.handleKey(event)
      );

      this.bind(
        document,
        'pointermove',
        (event) => {
          if (
            this.state.get(
              'settings.reducedMotion'
            )
          ) {
            return;
          }

          document.documentElement
            .style.setProperty(
              '--pointer-x',
              `${
                (
                  event.clientX /
                  window.innerWidth
                ) * 100
              }%`
            );

          document.documentElement
            .style.setProperty(
              '--pointer-y',
              `${
                (
                  event.clientY /
                  window.innerHeight
                ) * 100
              }%`
            );
        },
        {
          passive: true
        }
      );
    }
  }

  /* ========================================================================
     NARRATIVE ENGINE
     ======================================================================== */

  class NarrativeEngine {
    constructor(
      state,
      bus,
      ui,
      logger,
      audio,
      missions,
      codex
    ) {
      this.state = state;
      this.bus = bus;
      this.ui = ui;
      this.logger = logger;
      this.audio = audio;
      this.missions = missions;
      this.codex = codex;

      this.timer = null;
      this.typing = false;
      this.fullText = '';
      this.charIndex = 0;
      this.current = null;
    }

    renderCinematic() {
      const index =
        clamp(
          this.state.get(
            'narrative.cinematicIndex'
          ),
          0,
          CINEMATICS.length -
            1
        );

      const cinematic =
        CINEMATICS[index];

      byId(
        'cinematicTitle'
      ).textContent =
        cinematic.title;

      byId(
        'cinematicText'
      ).textContent =
        cinematic.text;

      byId(
        'cinematicSceneIndex'
      ).textContent =
        `${String(
          index + 1
        ).padStart(
          2,
          '0'
        )} / ${String(
          CINEMATICS.length
        ).padStart(
          2,
          '0'
        )}`;

      byId(
        'cinematicActLabel'
      ).textContent =
        'PRÓLOGO';

      byId(
        'cinematicPrevious'
      ).disabled =
        index === 0;

      byId(
        'cinematicNext'
      ).textContent =
        index ===
        CINEMATICS.length -
          1
          ? 'ENTRAR NA CRÔNICA'
          : 'CONTINUAR';
    }

    nextCinematic() {
      this.audio.click();

      const index =
        this.state.get(
          'narrative.cinematicIndex'
        );

      if (
        index >=
        CINEMATICS.length -
          1
      ) {
        this.ui.transition(
          () => {
            this.ui.showScreen(
              'screenGame'
            );

            this.goto(
              this.state.get(
                'narrative.currentScene'
              ) ||
                'g_intro'
            );
          }
        );

        return;
      }

      this.state.set(
        'narrative.cinematicIndex',
        index + 1,
        'cinematic.next'
      );

      this.renderCinematic();
    }

    prevCinematic() {
      const index =
        this.state.get(
          'narrative.cinematicIndex'
        );

      if (index <= 0) {
        return;
      }

      this.audio.click();

      this.state.set(
        'narrative.cinematicIndex',
        index - 1,
        'cinematic.prev'
      );

      this.renderCinematic();
    }

    goto(id) {
      const scene =
        SCENES[id] ||
        SCENES.g_intro;

      this.current = scene;

      clearTimeout(
        this.timer
      );

      this.typing = false;

      this.state.set(
        'narrative.currentScene',
        id,
        'narrative.goto'
      );

      this.state.increment(
        'statistics.sceneChanges',
        1,
        'narrative.goto'
      );

      const seen =
        this.state.get(
          'narrative.seenScenes'
        );

      if (!seen.includes(id)) {
        this.state.set(
          'narrative.seenScenes',
          [
            ...seen,
            id
          ],
          'narrative.seen'
        );
      }

      if (scene.location) {
        const discovered =
          this.state.get(
            'world.discovered'
          );

        if (
          !discovered.includes(
            scene.location
          )
        ) {
          this.state.set(
            'world.discovered',
            [
              ...discovered,
              scene.location
            ],
            'world.discover'
          );
        }

        const visited =
          this.state.get(
            'world.visited'
          );

        if (
          !visited.includes(
            scene.location
          )
        ) {
          this.state.set(
            'world.visited',
            [
              ...visited,
              scene.location
            ],
            'world.visit'
          );
        }

        this.state.set(
          'world.location',
          scene.location,
          'narrative.location'
        );
      }

      this.applyOnEnter(
        scene.onEnter
      );

      byId(
        'dialogueSpeaker'
      ).textContent =
        scene.speaker;

      byId(
        'dialogueSpeakerRole'
      ).textContent =
        scene.role;

      byId(
        'dialogueType'
      ).textContent =
        scene.type;

      this.renderChoices(
        scene
      );

      this.typeText(
        scene.text
      );

      this.ui.render();

      this.bus.emit(
        'scene:changed',
        {
          id,
          scene
        }
      );
    }

    applyOnEnter(data) {
      if (!data) {
        return;
      }

      if (data.codex) {
        this.codex.unlock(
          data.codex
        );
      }

      if (
        data.missionUnlock
      ) {
        this.missions.unlock(
          data.missionUnlock
        );
      }

      if (
        data.missionProgress
      ) {
        this.missions.progress(
          data.missionProgress[
            0
          ],
          data.missionProgress[
            1
          ]
        );
      }

      if (
        data.missionComplete
      ) {
        this.missions.complete(
          data.missionComplete
        );
      }
    }

    typeText(text) {
      clearTimeout(
        this.timer
      );

      this.fullText =
        safeText(text);

      this.charIndex = 0;

      const el =
        byId(
          'dialogueText'
        );

      if (!el) {
        return;
      }

      el.textContent = '';

      this.typing = true;

      byId(
        'typingCursor'
      )?.classList.add(
        'active'
      );

      const speed =
        this.state.get(
          'settings.fastText'
        )
          ? 4
          : 18;

      const tick = () => {
        if (!this.typing) {
          return;
        }

        const chunk =
          this.state.get(
            'settings.fastText'
          )
            ? 4
            : 1;

        this.charIndex =
          Math.min(
            this.fullText.length,
            this.charIndex +
              chunk
          );

        el.textContent =
          this.fullText.slice(
            0,
            this.charIndex
          );

        if (
          this.charIndex >=
          this.fullText.length
        ) {
          this.typing =
            false;

          byId(
            'typingCursor'
          )?.classList.remove(
            'active'
          );

          return;
        }

        this.timer =
          setTimeout(
            tick,
            speed
          );
      };

      tick();

      this.state.increment(
        'statistics.dialogues',
        1,
        'narrative.type'
      );
    }

    skipTyping() {
      if (!this.typing) {
        return;
      }

      clearTimeout(
        this.timer
      );

      this.typing = false;

      const el =
        byId(
          'dialogueText'
        );

      if (el) {
        el.textContent =
          this.fullText;
      }

      byId(
        'typingCursor'
      )?.classList.remove(
        'active'
      );

      this.audio.click();
    }

    continue() {
      if (this.typing) {
        this.skipTyping();
        return;
      }

      const choices =
        this.availableChoices(
          this.current
        );

      if (choices.length) {
        this.ui.notify(
          'Escolha necessária',
          'Selecione uma resposta antes de continuar.',
          'warning'
        );

        this.audio.alert();

        return;
      }

      if (
        !this.current?.next
      ) {
        return;
      }

      if (
        this.current.next ===
        this.state.get(
          'narrative.currentScene'
        )
      ) {
        this.ui.notify(
          'Capítulo atual concluído',
          'Explore, reveja o códex ou continue a partir deste save em futuras expansões.',
          'info'
        );

        return;
      }

      this.audio.confirm();

      this.goto(
        this.current.next
      );
    }

    availableChoices(
      scene
    ) {
      return (
        scene?.choices || []
      ).filter(
        (choice) =>
          this.checkConditions(
            choice.conditions
          ) &&
          !(
            choice.once &&
            this.state
              .get(
                'narrative.choices'
              )
              .includes(
                choice.id
              )
          )
      );
    }

    checkConditions(
      condition
    ) {
      if (!condition) {
        return true;
      }

      if (
        condition.flag &&
        !this.state.get(
          `narrative.flags.${condition.flag}`
        )
      ) {
        return false;
      }

      if (
        condition.minHope !=
          null &&
        this.state.get(
          'player.stats.hope'
        ) <
          condition.minHope
      ) {
        return false;
      }

      return true;
    }

    renderChoices(scene) {
      const box =
        byId(
          'choiceContainer'
        );

      if (!box) {
        return;
      }

      box.replaceChildren();

      const choices =
        this.availableChoices(
          scene
        );

      choices.forEach(
        (
          choice,
          index
        ) => {
          const button =
            document.createElement(
              'button'
            );

          button.type =
            'button';

          button.className =
            'choice-button';

          button.innerHTML =
            `<span>${String(
              index + 1
            ).padStart(
              2,
              '0'
            )}</span>` +
            `<strong>${this.ui.escape(
              choice.text
            )}</strong>`;

          button.addEventListener(
            'click',
            () =>
              this.selectChoice(
                choice
              ),
            {
              once: true
            }
          );

          box.appendChild(
            button
          );
        }
      );
    }

    selectChoice(
      choice
    ) {
      if (this.typing) {
        this.skipTyping();
      }

      this.audio.choice();

      const effects =
        choice.effects ||
        {};

      for (
        const [key, value]
        of Object.entries(
          effects
        )
      ) {
        this.state.adjustStat(
          key,
          value,
          `choice.${choice.id}`
        );
      }

      for (
        const [key, value]
        of Object.entries(
          choice.flags ||
            {}
        )
      ) {
        this.state.set(
          `narrative.flags.${key}`,
          value,
          `choice.${choice.id}`
        );
      }

      if (choice.codex) {
        this.codex.unlock(
          choice.codex
        );
      }

      if (
        choice.missionProgress
      ) {
        this.missions.unlock(
          choice.missionProgress[
            0
          ]
        );

        this.missions.progress(
          choice.missionProgress[
            0
          ],
          choice.missionProgress[
            1
          ]
        );
      }

      const taken =
        this.state.get(
          'narrative.choices'
        );

      this.state.set(
        'narrative.choices',
        [
          ...taken,
          choice.id
        ],
        `choice.${choice.id}`
      );

      this.state.increment(
        'statistics.choices',
        1,
        `choice.${choice.id}`
      );

      this.bus.emit(
        'choice:selected',
        {
          id: choice.id
        }
      );

      this.goto(
        choice.next ||
          this.current.next
      );
    }
  }

  /* ========================================================================
     SETTINGS
     ======================================================================== */

  class SettingsManager {
    constructor(
      state,
      bus,
      ui,
      logger
    ) {
      this.state = state;
      this.bus = bus;
      this.ui = ui;
      this.logger = logger;
    }

    load() {
      try {
        const raw =
          JSON.parse(
            localStorage.getItem(
              SETTINGS_KEY
            ) ||
              'null'
          );

        if (raw) {
          this.state.patch(
            'settings',
            raw,
            'settings.load'
          );
        }
      } catch (error) {
        this.logger.warn(
          'Configurações antigas ignoradas',
          error.message
        );
      }
    }

    set(key, value) {
      this.state.set(
        `settings.${key}`,
        !!value,
        'settings.change'
      );

      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify(
            this.state.get(
              'settings'
            )
          )
        );
      } catch {}

      this.ui.render();

      this.bus.emit(
        'settings:changed',
        {
          key,
          value
        }
      );
    }
  }

  /* ========================================================================
     VISUAL LAB
     ======================================================================== */

  class VisualLab {
    constructor(
      state,
      bus,
      logger,
      ui
    ) {
      this.state = state;
      this.bus = bus;
      this.logger = logger;
      this.ui = ui;

      this.initialized =
        false;

      this.observer = null;
    }

    init() {
      if (
        this.initialized
      ) {
        return;
      }

      this.initialized =
        true;

      qsa(
        '.visual-lab-tab'
      ).forEach(
        (button) =>
          button.addEventListener(
            'click',
            () =>
              this.activate(
                button.dataset
                  .labTab
              )
          )
      );

      byId(
        'visualLabRefresh'
      )?.addEventListener(
        'click',
        () =>
          this.refresh()
      );

      byId(
        'visualLabClear'
      )?.addEventListener(
        'click',
        () => {
          this.logger.clear();
          this.refresh();
        }
      );

      try {
        this.observer =
          new MutationObserver(
            (mutations) => {
              this.logger
                .mutationCount +=
                mutations.length;
            }
          );

        this.observer.observe(
          byId('app'),
          {
            attributes: true,
            childList: true,
            subtree: true,
            characterData:
              false
          }
        );

        this.logger
          .observerCount = 1;
      } catch {}

      this.refresh();
    }

    activate(tab) {
      qsa(
        '.visual-lab-tab'
      ).forEach(
        (button) => {
          const active =
            button.dataset
              .labTab === tab;

          button.classList.toggle(
            'active',
            active
          );

          button.setAttribute(
            'aria-selected',
            String(active)
          );
        }
      );

      qsa(
        '[data-lab-panel]'
      ).forEach(
        (panel) =>
          panel.classList.toggle(
            'active',
            panel.dataset
              .labPanel === tab
          )
      );

      this.refresh();
    }

    refresh() {
      const set = (
        id,
        value
      ) => {
        const el =
          byId(id);

        if (el) {
          el.textContent =
            safeText(value);
        }
      };

      set(
        'visualLabLiveText',
        'LIVE'
      );

      set(
        'visualLabObserverCount',
        this.logger
          .observerCount
      );

      set(
        'visualLabMutationCount',
        this.logger
          .mutationCount
      );

      set(
        'visualLabEventCount',
        this.logger.eventCount
      );

      set(
        'visualLabFooterTarget',
        this.state.get(
          'narrative.currentScene'
        )
      );

      set(
        'visualLabAction',
        this.logger
          .lastFlow.event
      );

      set(
        'visualLabTarget',
        this.state.get(
          'world.location'
        )
      );

      set(
        'visualLabTimestamp',
        new Date()
          .toLocaleTimeString(
            'pt-BR'
          )
      );

      set(
        'visualLabEvent',
        this.logger
          .lastFlow.event
      );

      set(
        'visualLabFunction',
        this.logger
          .lastFlow.function
      );

      set(
        'visualLabState',
        this.logger
          .lastFlow.state
      );

      set(
        'visualLabDomUpdate',
        this.logger
          .lastFlow.dom
      );

      set(
        'visualLabResult',
        this.logger
          .lastFlow.result
      );

      const selection =
        byId(
          'visualLabSelection'
        );

      if (selection) {
        selection.textContent =
          `#${this.state.get(
            'narrative.currentScene'
          )} / ${this.state.get(
            'world.location'
          )}`;
      }

      const context =
        byId(
          'visualLabContext'
        );

      if (context) {
        context.textContent =
          `phase=${this.state.get(
            'phase'
          )} · ` +
          `scene=${this.state.get(
            'narrative.currentScene'
          )} · ` +
          `save=${
            window.game?.save
              ?.hasSave()
              ? 'yes'
              : 'no'
          }`;
      }

      const dom =
        byId(
          'visualLabDomTree'
        );

      if (dom) {
        dom.textContent =
          this.domTree();
      }

      const css =
        byId(
          'visualLabCssMetrics'
        );

      if (css) {
        css.textContent =
          this.cssMetrics();
      }

      const log =
        byId(
          'visualLabJsLog'
        );

      if (log) {
        log.textContent =
          this.logger.entries
            .slice(-28)
            .map(
              (entry) =>
                `[${entry.time}] ` +
                `${entry.level.toUpperCase()} ` +
                `${entry.message}` +
                `${
                  entry.detail
                    ? ` — ${entry.detail}`
                    : ''
                }`
            )
            .join('\n') ||
          'Sem eventos registrados.';
      }

      const tests =
        byId(
          'visualLabTests'
        );

      if (tests) {
        tests.innerHTML =
          this.runTests()
            .map(
              (test) =>
                `<div class="lab-test ${
                  test.ok
                    ? 'pass'
                    : 'fail'
                }">` +
                `<span>${
                  test.ok
                    ? 'PASS'
                    : 'FAIL'
                }</span>` +
                `<strong>${test.name}</strong>` +
                `</div>`
            )
            .join('');
      }

      this.drawCanvas();
    }

    domTree() {
      return qsa(
        '#app [id]'
      )
        .slice(0, 70)
        .map(
          (el) =>
            `${'  '.repeat(
              Math.min(
                3,
                this.depth(el)
              )
            )}` +
            `<${el.tagName.toLowerCase()} id="${el.id}">`
        )
        .join('\n');
    }

    depth(el) {
      let depth = 0;

      while (
        el.parentElement &&
        el.parentElement.id !==
          'app' &&
        depth < 3
      ) {
        depth += 1;

        el =
          el.parentElement;
      }

      return depth;
    }

    cssMetrics() {
      const root =
        getComputedStyle(
          document
            .documentElement
        );

      return [
        `viewport: ${window.innerWidth}×${window.innerHeight}`,

        `--bg-0: ${root
          .getPropertyValue(
            '--bg-0'
          )
          .trim()}`,

        `--accent: ${root
          .getPropertyValue(
            '--accent'
          )
          .trim()}`,

        `motion: ${
          this.state.get(
            'settings.reducedMotion'
          )
            ? 'reduced'
            : 'full'
        }`,

        `contrast: ${
          this.state.get(
            'settings.highContrast'
          )
            ? 'high'
            : 'standard'
        }`,

        `DOM nodes: ${
          document.getElementsByTagName(
            '*'
          ).length
        }`
      ].join('\n');
    }

    runTests() {
      return [
        {
          name:
            'window.game disponível',

          ok:
            !!window.game
        },

        {
          name:
            'StateManager íntegro',

          ok:
            !!this.state.get(
              'player.stats'
            )
        },

        {
          name:
            'Tela principal encontrada',

          ok:
            !!byId(
              'screenGame'
            )
        },

        {
          name:
            'SaveManager disponível',

          ok:
            typeof window.game
              ?.save?.save ===
            'function'
        },

        {
          name:
            'NarrativeEngine disponível',

          ok:
            typeof window.game
              ?.narrative
              ?.goto ===
            'function'
        },

        {
          name:
            'Estatísticas dentro de 0–100',

          ok:
            [
              'hope',
              'freedom',
              'control',
              'temporal'
            ].every(
              (key) =>
                Number.isFinite(
                  this.state.get(
                    `player.stats.${key}`
                  )
                ) &&
                this.state.get(
                  `player.stats.${key}`
                ) >= 0 &&
                this.state.get(
                  `player.stats.${key}`
                ) <= 100
            )
        },

        {
          name:
            'IDs duplicados inexistentes',

          ok:
            this.duplicateIds()
              .length === 0
        }
      ];
    }

    duplicateIds() {
      const ids =
        qsa('[id]').map(
          (el) => el.id
        );

      return ids.filter(
        (id, index) =>
          ids.indexOf(id) !==
          index
      );
    }

    drawCanvas() {
      const canvas =
        byId(
          'visualLabCanvas'
        );

      if (
        !(
          canvas instanceof
          HTMLCanvasElement
        )
      ) {
        return;
      }

      const rect =
        canvas.getBoundingClientRect();

      const dpr =
        Math.min(
          window.devicePixelRatio ||
            1,
          2
        );

      const width =
        Math.max(
          300,
          Math.floor(
            rect.width || 600
          )
        );

      const height =
        Math.max(
          160,
          Math.floor(
            rect.height || 260
          )
        );

      if (
        canvas.width !==
          width * dpr ||
        canvas.height !==
          height * dpr
      ) {
        canvas.width =
          width * dpr;

        canvas.height =
          height * dpr;
      }

      const ctx =
        canvas.getContext(
          '2d'
        );

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      ctx.strokeStyle =
        'rgba(139,200,255,.28)';

      ctx.lineWidth = 1;

      for (
        let x = 0;
        x < width;
        x += 32
      ) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(
          x,
          height
        );
        ctx.stroke();
      }

      for (
        let y = 0;
        y < height;
        y += 32
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(
          width,
          y
        );
        ctx.stroke();
      }

      const stats = [
        'hope',
        'freedom',
        'control',
        'temporal'
      ].map(
        (key) =>
          this.state.get(
            `player.stats.${key}`
          )
      );

      ctx.beginPath();

      ctx.strokeStyle =
        'rgba(211,236,255,.9)';

      ctx.lineWidth = 2;

      stats.forEach(
        (value, index) => {
          const x =
            24 +
            (
              index *
              (width - 48)
            ) /
              (
                stats.length -
                1
              );

          const y =
            height -
            24 -
            (value / 100) *
              (height - 48);

          if (index === 0) {
            ctx.moveTo(
              x,
              y
            );
          } else {
            ctx.lineTo(
              x,
              y
            );
          }

          ctx.fillStyle =
            'rgba(211,236,255,.9)';

          ctx.fillRect(
            x - 2,
            y - 2,
            4,
            4
          );
        }
      );

      ctx.stroke();
    }
  }

  /* ========================================================================
     GAME CONTROLLER
     ======================================================================== */

  class GameController {
    constructor() {
      this.initialized =
        false;

      this.logger =
        new GameLogger();

      this.bus =
        new EventBus(
          this.logger
        );

      this.state =
        new StateManager(
          this.bus,
          this.logger
        );

      this.audio =
        new AudioManager(
          this.state,
          this.logger
        );

      this.ui =
        new UIManager(
          this.state,
          this.bus,
          this.logger,
          this.audio
        );

      this.notify =
        this.ui.notify;

      this.missions =
        new MissionManager(
          this.state,
          this.bus,
          this.notify
        );

      this.codex =
        new CodexManager(
          this.state,
          this.bus,
          this.notify
        );

      this.save =
        new SaveManager(
          this.state,
          this.bus,
          this.logger,
          this.notify
        );

      this.settings =
        new SettingsManager(
          this.state,
          this.bus,
          this.ui,
          this.logger
        );

      this.narrative =
        new NarrativeEngine(
          this.state,
          this.bus,
          this.ui,
          this.logger,
          this.audio,
          this.missions,
          this.codex
        );

      this.particles =
        new ParticleSystem(
          this.state
        );

      this.visualLab =
        new VisualLab(
          this.state,
          this.bus,
          this.logger,
          this.ui
        );

      this.playTimer =
        null;
    }

    initialize() {
      if (
        this.initialized
      ) {
        return this;
      }

      this.initialized =
        true;

      try {
        this.settings.load();

        this.ui.initBindings(
          this
        );

        this.visualLab.init();

        this.particles.init();

        this.bindInternalEvents();

        this.ui.render();

        this.narrative
          .renderCinematic();

        this.ui.showScreen(
          'screenTitle'
        );

        this.startPlayClock();

        this.logger.info(
          'GameController inicializado',
          VERSION
        );

        this.bus.emit(
          'game:ready',
          {
            version:
              VERSION
          }
        );
      } catch (error) {
        this.recover(error);
      }

      return this;
    }

    bindInternalEvents() {
      this.bus.on(
        'state:changed',
        ({
          source
        }) => {
          if (
            source !==
            'save.load'
          ) {
            this.ui.render();

            if (
              this.state.get(
                'phase'
              ) === 'game' &&
              !source.startsWith(
                'settings'
              )
            ) {
              this.save.schedule();
            }
          }
        }
      );

      this.bus.on(
        'save:completed',
        () =>
          this.ui
            .renderSaveStatus()
      );

      this.bus.on(
        'save:deleted',
        () =>
          this.ui
            .renderSaveStatus()
      );

      this.bus.on(
        'scene:changed',
        () => {
          this.ui.render();

          if (
            !this.state.get(
              'settings.reducedMotion'
            )
          ) {
            byId(
              'worldViewport'
            )?.classList.add(
              'scene-pulse'
            );
          }

          setTimeout(
            () =>
              byId(
                'worldViewport'
              )?.classList.remove(
                'scene-pulse'
              ),
            450
          );
        }
      );

      this.bus.on(
        'choice:selected',
        () =>
          this.save.schedule()
      );

      window.addEventListener(
        'error',
        (event) =>
          this.logger.error(
            'Erro global',
            event.error ||
              event.message
          )
      );

      window.addEventListener(
        'unhandledrejection',
        (event) =>
          this.logger.error(
            'Promise rejeitada',
            event.reason
          )
      );
    }

    startPlayClock() {
      if (this.playTimer) {
        return;
      }

      this.playTimer =
        setInterval(
          () => {
            if (
              this.state.get(
                'phase'
              ) === 'game' &&
              !document.hidden
            ) {
              this.state.get(
                'meta'
              ).playSeconds +=
                1;
            }
          },
          1000
        );
    }

    startNewGame() {
      this.audio.confirm();

      this.state.reset(
        true
      );

      this.settings.load();

      this.state.set(
        'phase',
        'cinematic',
        'game.new'
      );

      this.state.set(
        'narrative.cinematicIndex',
        0,
        'game.new'
      );

      this.ui.transition(
        () => {
          this.ui.showScreen(
            'screenCinematic'
          );

          this.narrative
            .renderCinematic();
        }
      );

      this.save.schedule();
    }

    continueGame(
      fromOverlay = false
    ) {
      if (!this.save.load()) {
        return;
      }

      this.audio.confirm();

      if (fromOverlay) {
        this.ui.closeOverlay(
          'saveOverlay'
        );
      }

      const phase =
        this.state.get(
          'phase'
        );

      this.ui.transition(
        () => {
          if (
            phase ===
            'cinematic'
          ) {
            this.ui.showScreen(
              'screenCinematic'
            );

            this.narrative
              .renderCinematic();
          } else {
            this.ui.showScreen(
              'screenGame'
            );

            this.narrative.goto(
              this.state.get(
                'narrative.currentScene'
              ) ||
                'g_intro'
            );
          }
        }
      );
    }

    restartToTitle() {
      this.ui.closeOverlay(
        'menuOverlay'
      );

      this.audio.alert();

      this.ui.transition(
        () =>
          this.ui.showScreen(
            'screenTitle'
          )
      );
    }

    deleteSaveWithConfirm() {
      const message =
        'Clique novamente em APAGAR SAVE dentro de 4 segundos para confirmar.';

      const button =
        byId(
          'deleteSaveButton'
        );

      if (!button) {
        return;
      }

      if (
        button.dataset
          .confirming === '1'
      ) {
        delete button.dataset
          .confirming;

        button.textContent =
          'APAGAR SAVE';

        this.save.delete();

        this.ui.render();

        return;
      }

      button.dataset
        .confirming = '1';

      button.textContent =
        'CONFIRMAR EXCLUSÃO';

      this.notify(
        'Confirme a exclusão',
        message,
        'warning'
      );

      setTimeout(
        () => {
          if (
            button.dataset
              .confirming ===
            '1'
          ) {
            delete button
              .dataset
              .confirming;

            button.textContent =
              'APAGAR SAVE';
          }
        },
        4000
      );
    }

    inspect() {
      this.audio.click();

      this.state.increment(
        'world.inspectCount',
        1,
        'world.inspect'
      );

      this.state.increment(
        'statistics.inspections',
        1,
        'world.inspect'
      );

      const location =
        this.state.get(
          'world.location'
        );

      const messages = {
        mega_city:
          'Drones de manutenção cruzam ruínas antigas. A cidade ainda funciona, mas quase tudo parece temporário.',

        chrono_lab:
          'O núcleo usa anéis de confinamento e correções probabilísticas. Cada salto exige energia suficiente para abastecer um distrito.',

        archive:
          'Marcas de edição aparecem nos relatórios. Alguém removeu trechos antes de você chegar.',

        transit:
          'Não há paredes aqui. Apenas versões incompletas do mesmo instante.',

        galilee:
          'Poeira, vozes, comércio, animais. Nada aqui sabe que será chamado de “passado”.'
      };

      this.notify(
        'Inspeção',
        messages[location] ||
          'Você observa os arredores.',
        'info'
      );

      if (
        this.state.get(
          'world.inspectCount'
        ) === 1
      ) {
        this.missions.progress(
          'intro',
          1
        );
      }

      if (
        location ===
        'archive'
      ) {
        this.codex.unlock(
          'archive'
        );

        this.missions.unlock(
          'truth'
        );
      }
    }

    activateSystemTab(id) {
      qsa(
        '.system-tab'
      ).forEach(
        (button) =>
          button.classList.toggle(
            'active',
            button.dataset.tab ===
              id
          )
      );

      qsa(
        '.system-tab-content'
      ).forEach(
        (panel) =>
          panel.classList.toggle(
            'active',
            panel.id === id
          )
      );

      if (
        id ===
        'codexTab'
      ) {
        this.codex.unlock(
          'future'
        );
      }

      this.audio.click();
    }

    handleKey(event) {
      if (
        (
          event.ctrlKey ||
          event.metaKey
        ) &&
        event.key
          .toLowerCase() ===
          's'
      ) {
        event.preventDefault();

        this.save.save();

        return;
      }

      if (
        event.key ===
        'Escape'
      ) {
        if (
          this.ui
            .closeTopOverlay()
        ) {
          return;
        }

        if (
          this.state.get(
            'phase'
          ) === 'game'
        ) {
          this.ui.openOverlay(
            'menuOverlay'
          );
        }

        return;
      }

      if (
        this.state.get(
          'phase'
        ) !== 'game' ||
        [
          'INPUT',
          'TEXTAREA'
        ].includes(
          document.activeElement
            ?.tagName
        )
      ) {
        return;
      }

      if (
        event.key
          .toLowerCase() ===
        'e'
      ) {
        event.preventDefault();
        this.inspect();
      }

      if (
        event.key ===
          'Enter' &&
        !event.repeat
      ) {
        event.preventDefault();

        this.narrative
          .continue();
      }

      if (
        /^[1-9]$/.test(
          event.key
        )
      ) {
        const choice =
          qs(
            `.choice-button:nth-child(${Number(
              event.key
            )})`
          );

        choice?.click();
      }
    }

    recover(error) {
      this.logger.error(
        'Falha crítica de inicialização',
        error
      );

      try {
        this.ui.showScreen(
          'screenTitle'
        );

        this.notify(
          'Recuperação ativada',
          'O jogo encontrou um erro, mas manteve a tela inicial disponível.',
          'error'
        );
      } catch {}
    }
  }

  /* ========================================================================
     BOOT
     ======================================================================== */

  function injectRuntimeStyles() {
    /*
     * As melhorias visuais ficam no style.css.
     * Mantemos esta função porque versões futuras podem precisar
     * adicionar estilos temporários de depuração em runtime.
     */
  }

  const boot = () => {
    if (
      window.game
        ?.initialized
    ) {
      return;
    }

    injectRuntimeStyles();

    const game =
      new GameController();

    Object.defineProperty(
      window,
      'game',
      {
        value: game,
        configurable: true,
        enumerable: true,
        writable: false
      }
    );

    game.initialize();
  };

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {
        once: true
      }
    );
  } else {
    queueMicrotask(
      boot
    );
  }
})();
