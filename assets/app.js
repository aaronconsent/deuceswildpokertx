/* ==========================================================================
   Deuces Wild Poker Club — shared front-end JS
   Powers the live seat-status widget (home) + tournament countdowns.
   All times are America/Chicago (Central). The club is open:
     Wed/Thu/Fri 19:00 -> last hand ; Sat 18:00 -> last hand.
   Tournaments: Wed 19:00, Sat 18:00.
   ========================================================================== */
(function () {
  // Day index: 0=Sun ... 6=Sat. Open windows (24h, Central). "close" is a
  // status-only cutoff (real close is "last hand"); used only for the fallback
  // when the live API reports no active sessions.
  const SCHEDULE = {
    3: { open: 19, close: 26, label: 'Wednesday' }, // Wed (26 = 2 AM next day)
    4: { open: 19, close: 26, label: 'Thursday' },
    5: { open: 19, close: 26, label: 'Friday' },
    6: { open: 18, close: 26, label: 'Saturday' },
  };
  // Weekly tournaments: [day, hour]
  const TOURNAMENTS = [ [3, 19], [6, 18] ];

  // Return {parts:{d,h,m,s}, total} for a future Date.
  function diff(future, now) {
    let t = Math.max(0, Math.floor((future - now) / 1000));
    const d = Math.floor(t / 86400); t -= d * 86400;
    const h = Math.floor(t / 3600);  t -= h * 3600;
    const m = Math.floor(t / 60);    const s = t - m * 60;
    return { d, h, m, s, total: future - now };
  }

  // Get "now" as a Central-time Date-ish via offset math. We read the local
  // browser time but compute schedule in Central by shifting. Simplicity over
  // perfection: assumes the venue/users are in Central (Texas).
  function centralNow() {
    const now = new Date();
    // Convert to Central regardless of viewer TZ.
    const c = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    return c;
  }

  // Next scheduled open datetime (Central) from a given moment.
  function nextOpen(from) {
    for (let i = 0; i < 8; i++) {
      const day = new Date(from);
      day.setDate(from.getDate() + i);
      const sch = SCHEDULE[day.getDay()];
      if (!sch) continue;
      const open = new Date(day); open.setHours(sch.open, 0, 0, 0);
      if (open > from) return { when: open, label: sch.label };
      // same-day already open handled by caller; keep scanning future days
    }
    return null;
  }

  // Next tournament datetime (Central).
  function nextTournament(from) {
    let best = null;
    for (let i = 0; i < 8; i++) {
      const day = new Date(from);
      day.setDate(from.getDate() + i);
      for (const [d, h] of TOURNAMENTS) {
        if (day.getDay() !== d) continue;
        const t = new Date(day); t.setHours(h, 0, 0, 0);
        if (t > from && (!best || t < best)) best = t;
      }
    }
    return best;
  }

  // Are we within a scheduled open window right now (fallback only)?
  function scheduledOpen(from) {
    const sch = SCHEDULE[from.getDay()];
    if (!sch) return false;
    const hour = from.getHours() + from.getMinutes() / 60;
    if (hour >= sch.open && hour < sch.close - 24 + 24) {
      // open window same calendar day
      return hour >= sch.open;
    }
    return false;
  }

  const SUIT = { holdem_cash: 'spade', omaha_cash: 'diamond', tournament: 'club' };
  function gameLabel(t) {
    return { holdem_cash: "Hold'em Cash", omaha_cash: 'Omaha Cash', tournament: 'Tournament' }[t] || t;
  }

  // Alpine component: live seat status widget.
  window.liveStatus = function () {
    return {
      loading: true, apiOk: false, open: false,
      seatsFree: 0, sessions: [], nextOpenLabel: '', nextOpenWhen: null,
      nextTourLabel: '', countdown: '',
      _timer: null, _poll: null,

      init() {
        this.refresh();
        this._poll = setInterval(() => this.refresh(), 60000);
        this._timer = setInterval(() => this.tick(), 1000);
        this.tick();
      },
      destroy() { clearInterval(this._poll); clearInterval(this._timer); },

      async refresh() {
        try {
          const r = await fetch('/api/sessions', { headers: { 'Accept': 'application/json' } });
          if (!r.ok) throw new Error('bad status');
          const d = await r.json();
          this.apiOk = true;
          this.sessions = (d.sessions || []).map(s => ({
            ...s, suit: SUIT[s.game_type] || 'spade', label: gameLabel(s.game_type),
          }));
          this.open = this.sessions.length > 0;
          this.seatsFree = d.seats_available != null ? d.seats_available
            : this.sessions.reduce((a, s) => a + (s.total_seats - s.seated), 0);
          this.computeSchedule();
        } catch (e) {
          this.apiOk = false;            // graceful degradation -> schedule mode
          this.open = false;
          this.computeSchedule();
        } finally {
          this.loading = false;
        }
      },

      computeSchedule() {
        const now = centralNow();
        const no = nextOpen(now);
        this.nextOpenLabel = no ? no.label : '';
        this.nextOpenWhen = no ? no.when : null;
        const nt = nextTournament(now);
        this.nextTourLabel = nt ? this.fmtDay(nt) : '';
        this._nextTour = nt;
      },

      fmtDay(dt) {
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        let h = dt.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        return `${days[dt.getDay()]} ${h}:00 ${ap}`;
      },

      tick() {
        const now = centralNow();
        const target = this._nextTour || (this.nextOpenWhen);
        if (!target) { this.countdown = ''; return; }
        const dd = diff(target, now);
        this.countdown = (dd.d ? dd.d + 'd ' : '') +
          String(dd.h).padStart(2,'0') + ':' + String(dd.m).padStart(2,'0') + ':' + String(dd.s).padStart(2,'0');
      },
    };
  };

  // Manifest-driven photo carousel. Reads /data/photos.json; renders real
  // images for the named group, or N branded placeholders if none yet.
  window.photoGallery = function (group) {
    return {
      slides: [], n: 1, i: 0, base: '/assets/img/',
      async init() {
        let photos = [], count = 4;
        try {
          const d = await fetch('/data/photos.json').then(r => r.json());
          this.base = d.base || this.base;
          photos = ((d.groups && d.groups[group]) || []).filter(p => p && p.file);
          count = (d.placeholders && d.placeholders[group]) || 4;
        } catch (e) {}
        this.slides = photos.length
          ? photos.map(p => ({ img: this.base + p.file, alt: p.alt || 'Inside Deuces Wild Poker Club' }))
          : Array.from({ length: count }, (_, k) => ({ placeholder: k + 1, total: count }));
        this.n = this.slides.length;
      },
      prev() { this.i = (this.i - 1 + this.n) % this.n; },
      next() { this.i = (this.i + 1) % this.n; },
    };
  };

  // Single owner portrait. Reads /data/photos.json portraits[name]; shows the
  // image if present, otherwise leaves the branded placeholder visible.
  window.portrait = function (name) {
    return {
      src: '', alt: '',
      async init() {
        try {
          const d = await fetch('/data/photos.json').then(r => r.json());
          const f = d.portraits && d.portraits[name];
          if (f) this.src = (d.base || '/assets/img/') + f;
        } catch (e) {}
      },
    };
  };

  // Standalone countdown to next tournament (used on /tournaments/).
  window.tourCountdown = function () {
    return {
      countdown: '', label: '', _t: null, _target: null,
      init() {
        const nt = nextTournament(centralNow());
        this._target = nt;
        const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        if (nt){ let h=nt.getHours(); const ap=h>=12?'PM':'AM'; h=h%12||12; this.label=`${days[nt.getDay()]} ${h}:00 ${ap} Central`; }
        this.tick(); this._t = setInterval(()=>this.tick(),1000);
      },
      destroy(){ clearInterval(this._t); },
      tick(){
        if(!this._target){this.countdown='';return;}
        const dd=diff(this._target, centralNow());
        this.countdown=(dd.d?dd.d+'d ':'')+String(dd.h).padStart(2,'0')+':'+String(dd.m).padStart(2,'0')+':'+String(dd.s).padStart(2,'0');
      }
    };
  };
})();
