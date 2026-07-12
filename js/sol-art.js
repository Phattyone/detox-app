/* js/sol-art.js
   Plain JS/SVG translation of assets/Design/sol-export/SolArt.dc.html
   (Claude Design export). No framework, no build step.
   Every coordinate, color, and path value matches the source exactly.

   Public API:
     renderSolArt({ stage, expression, variant, innerRing, tiredTongue })
       Returns an SVG markup string ready for innerHTML.
*/

(function () {

  // Convert camelCase attribute names used by React/JSX to SVG kebab-case.
  // Anything not in the map is returned unchanged (covers cx, cy, r, d, fill, etc.)
  function camelToKebabForSVG(k) {
    var map = {
      strokeWidth:     'stroke-width',
      strokeLinecap:   'stroke-linecap',
      strokeLinejoin:  'stroke-linejoin',
      strokeDasharray: 'stroke-dasharray',
      clipPath:        'clip-path',
      fillRule:        'fill-rule',
      fontFamily:      'font-family',
      fontSize:        'font-size',
      fontWeight:      'font-weight',
      fontStyle:       'font-style',
    };
    return map[k] || k;
  }

  // Recursively flatten nested arrays / values into a single string.
  function flatten(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.map(flatten).join('');
    return String(val);
  }

  // Build an SVG element string.
  // Drops the React-only `key` prop. Converts camelCase attr names.
  // Converts style objects to inline CSS strings.
  // Children may be strings, arrays, or spread rest args.
  function svgEl(tag, attrs) {
    if (!attrs) attrs = {};
    var children = Array.prototype.slice.call(arguments, 2);
    var parts = [];
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === 'key') continue;
      var v = attrs[k];
      if (k === 'style' && typeof v === 'object') {
        var css = Object.keys(v).map(function (p) {
          var prop = p.replace(/([A-Z])/g, function (m) { return '-' + m.toLowerCase(); });
          return prop + ':' + v[p];
        }).join(';');
        parts.push('style="' + css + '"');
      } else {
        parts.push(camelToKebabForSVG(k) + '="' + v + '"');
      }
    }
    var attrStr = parts.length ? ' ' + parts.join(' ') : '';
    var kids = flatten(children);
    return '<' + tag + attrStr + '>' + kids + '</' + tag + '>';
  }

  function renderSolArt(opts) {
    if (!opts) opts = {};
    var stage      = opts.stage      !== undefined ? opts.stage      : 4;
    var expression = opts.expression !== undefined ? opts.expression : 'happy';
    var variant    = opts.variant    !== undefined ? opts.variant    : 'plant';
    var innerRing  = opts.innerRing  !== undefined ? opts.innerRing  : 39;
    var tiredTongue = opts.tiredTongue !== false; // default true

    // ---- palette (exact) ----
    var P = {
      forest:'#1B4332', pine:'#0F2E21', cream:'#FAF5EA', ink:'#22382E',
      inkSoft:'#5C7266', sage:'#DCEBDD', sageDeep:'#74A57F', gold:'#D9A441',
      goldSoft:'#F3E3C2', petal:'#E9B94D', terra:'#C96F4A', terraSoft:'#F7E4DA',
      water:'#7FB6C4', waterSoft:'#DCEEF2'
    };
    var INK = P.ink, SW = 3.2, FW = 3.6;
    stage = Number(stage != null ? stage : 4);
    var expr = expression || 'happy';
    innerRing = Number(innerRing != null ? innerRing : 39);

    // ---------- primitives ----------
    var path = function (d, o) {
      var base = {d:d, fill:'none', stroke:INK, strokeWidth:SW, strokeLinecap:'round', strokeLinejoin:'round'};
      return svgEl('path', Object.assign({}, base, o || {}));
    };

    var eye = function (x, y, r) {
      if (r === undefined) r = 5.2;
      return [
        svgEl('circle', {cx:x, cy:y, r:r, fill:INK}),
        svgEl('circle', {cx:x-1.9, cy:y-2, r:1.7, fill:'#fff'})
      ];
    };

    var cheek = function (x, y) {
      return svgEl('ellipse', {cx:x, cy:y, rx:6.5, ry:4.6, fill:P.terra, opacity:0.42});
    };

    var star = function (cx, cy, r, fill) {
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var rr = i % 2 ? r * 0.44 : r;
        var a = -Math.PI / 2 + i * Math.PI / 5;
        pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
      }
      return svgEl('polygon', {points:pts.join(' '), fill:fill, stroke:INK, strokeWidth:2.4, strokeLinejoin:'round'});
    };

    var spark = function (cx, cy, r, fill) {
      if (fill === undefined) fill = P.gold;
      var pts = [];
      for (var i = 0; i < 8; i++) {
        var rr = i % 2 ? r * 0.34 : r;
        var a = -Math.PI / 2 + i * Math.PI / 4;
        pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
      }
      return svgEl('polygon', {points:pts.join(' '), fill:fill, stroke:INK, strokeWidth:1.6, strokeLinejoin:'round'});
    };

    // ---------- face groups (all on same head, centered ~ (120,92)) ----------
    var faces = {
      happy: function () { return [
        cheek(97,99), cheek(143,99),
        eye(105,84), eye(135,84),
        path('M107,105 Q120,117 133,105', {strokeWidth:FW})
      ]; },
      delighted: function () { return [
        cheek(96,100), cheek(144,100),
        path('M99,88 Q105,80 111,88', {strokeWidth:FW}),
        path('M129,88 Q135,80 141,88', {strokeWidth:FW}),
        svgEl('path', {d:'M104,103 Q120,124 136,103 Z', fill:INK, stroke:INK, strokeWidth:FW, strokeLinejoin:'round'}),
        svgEl('path', {d:'M113,113 Q120,121 127,113 Z', fill:P.terra})
      ]; },
      wink: function () { return [
        cheek(97,99), cheek(143,99),
        eye(105,84),
        path('M129,89 Q135,82 141,89', {strokeWidth:FW}),
        path('M107,105 Q121,118 134,104', {strokeWidth:FW})
      ]; },
      star: function () { return [
        cheek(96,100), cheek(144,100),
        star(105,84,10,P.gold), star(135,84,10,P.gold),
        svgEl('path', {d:'M107,104 Q120,120 133,104 Z', fill:INK, stroke:INK, strokeWidth:FW, strokeLinejoin:'round'})
      ]; },
      celebrate: function () { return [
        spark(64,58,8), spark(176,60,7), spark(82,126,6.5), spark(158,124,5.5),
        cheek(95,100), cheek(145,100),
        path('M98,88 Q105,79 112,88', {strokeWidth:FW}),
        path('M128,88 Q135,79 142,88', {strokeWidth:FW}),
        svgEl('ellipse', {cx:120, cy:108, rx:15, ry:12, fill:INK}),
        svgEl('path', {d:'M110,112 Q120,122 130,112 Z', fill:P.terra})
      ]; },
      sleepy: function () { return [
        svgEl('text', {x:150, y:56, fontFamily:'Baloo 2, sans-serif', fontSize:15, fontWeight:700, fill:P.sageDeep, fontStyle:'italic'}, 'z'),
        svgEl('text', {x:162, y:44, fontFamily:'Baloo 2, sans-serif', fontSize:20, fontWeight:700, fill:P.sageDeep, fontStyle:'italic'}, 'z'),
        cheek(96,100), cheek(144,100),
        path('M98,86 Q105,92 112,86', {strokeWidth:FW}),
        path('M128,86 Q135,92 142,86', {strokeWidth:FW}),
        path('M113,107 Q120,112 127,107', {strokeWidth:FW})
      ]; },
      thirsty: function () { return [
        eye(105,85,4.4), eye(135,85,4.4),
        // sweat drop
        svgEl('path', {d:'M156,74 C150,84 148,90 154,92 C160,90 160,84 156,74 Z', fill:P.water, stroke:INK, strokeWidth:2.2, strokeLinejoin:'round'}),
        // open panting mouth + tongue
        svgEl('path', {d:'M110,104 Q120,113 130,104 Z', fill:INK, stroke:INK, strokeWidth:FW, strokeLinejoin:'round'}),
        svgEl('path', {d:'M114,110 q6,14 12,0 q-1,-4 -6,-4 q-5,0 -6,4 Z', fill:P.terra, stroke:INK, strokeWidth:2})
      ]; },
      thinking: function () { return [
        // rising thought dots
        svgEl('circle', {cx:158, cy:66, r:3, fill:P.inkSoft}),
        svgEl('circle', {cx:168, cy:54, r:4, fill:P.inkSoft}),
        svgEl('circle', {cx:180, cy:40, r:5.5, fill:P.inkSoft, opacity:0.85}),
        // raised brow
        path('M128,74 Q135,70 143,74', {strokeWidth:3}),
        eye(104,86,5), eye(136,85,4.4),
        path('M111,108 Q118,105 125,109', {strokeWidth:FW})
      ]; },
      tired: function () {
        var tongue = tiredTongue ? [
          svgEl('path', {d:'M128,109 C133,113 131,123 123,127 C116,130 110,125 112,118 C114,112 122,108 128,109 Z', fill:P.terra, stroke:INK, strokeWidth:2.6, strokeLinejoin:'round'}),
          svgEl('path', {d:'M124,113 C122,119 121,123 121,126', fill:'none', stroke:INK, strokeWidth:1.8, strokeLinecap:'round', opacity:0.45}),
          // water drop dripping from the tip of the tongue
          svgEl('path', {d:'M121,128 C117,134 116,139 121,140 C126,139 125,134 121,128 Z', fill:P.water, stroke:INK, strokeWidth:1.8, strokeLinejoin:'round'}),
          svgEl('circle', {cx:119, cy:134, r:1.3, fill:'#fff', opacity:0.8})
        ] : [];
        return [
          // heavy half-lidded, drooping eyes -- upper lids sag over small pupils
          path('M98,86 Q105,90 112,85', {strokeWidth:FW}),
          svgEl('circle', {cx:105, cy:88, r:2.8, fill:INK}),
          path('M128,85 Q135,90 142,86', {strokeWidth:FW}),
          svgEl('circle', {cx:135, cy:88, r:2.8, fill:INK}),
          // weary under-eye lines
          path('M101,96 Q105,98 109,96', {strokeWidth:2}),
          path('M131,96 Q135,98 139,96', {strokeWidth:2}),
          // slightly open, worn-out mouth
          svgEl('path', {d:'M110,108 Q120,104 130,108 Q124,115 120,115 Q115,115 110,108 Z', fill:P.pine, stroke:INK, strokeWidth:3, strokeLinejoin:'round'}),
          // lolling tongue: attaches at the right corner, hangs down and to the left
          tongue
        ];
      },
      surprised: function () { return [
        // raised brows
        path('M98,73 Q105,70 112,73', {strokeWidth:3}),
        path('M128,73 Q135,70 142,73', {strokeWidth:3}),
        svgEl('circle', {cx:105, cy:86, r:8, fill:P.cream, stroke:INK, strokeWidth:FW}),
        svgEl('circle', {cx:105, cy:87, r:4, fill:INK}),
        svgEl('circle', {cx:135, cy:86, r:8, fill:P.cream, stroke:INK, strokeWidth:FW}),
        svgEl('circle', {cx:135, cy:87, r:4, fill:INK}),
        svgEl('ellipse', {cx:120, cy:110, rx:6, ry:7, fill:P.pine, stroke:INK, strokeWidth:3})
      ]; }
    };

    // ---------- head (petals + disc + face) around (cx,cy) ----------
    var headGroup = function (showFace) {
      var cx = 120, cy = 92, disc = 42;
      var petalRing = function (count, start, dist, rx, ry, fill, stroke) {
        var els = [];
        for (var i = 0; i < count; i++) {
          var a = start + i * (360 / count);
          els.push(
            svgEl('g', {transform:'rotate(' + a + ' ' + cx + ' ' + cy + ')'},
              svgEl('ellipse', {cx:cx, cy:cy-dist, rx:rx, ry:ry, fill:fill, stroke:stroke?INK:'none', strokeWidth:stroke?SW:0})
            )
          );
        }
        return els;
      };
      var els = [
        svgEl('g', {}, petalRing(12, 15, 60, 10, 25, P.gold, true)),
        svgEl('g', {}, petalRing(12, 0, 53, 11.5, 22, P.petal, true)),
        svgEl('circle', {cx:cx, cy:cy, r:disc, fill:P.goldSoft, stroke:INK, strokeWidth:SW}),
        svgEl('circle', {cx:cx, cy:cy, r:innerRing, fill:'none', stroke:P.gold, strokeWidth:2, opacity:0.55}),
      ];
      if (showFace) els.push(svgEl('g', {}, (faces[expr] || faces.happy)()));
      return svgEl('g', {}, els);
    };

    // ---------- pot ----------
    var pot = function () {
      return svgEl('g', {},
        svgEl('ellipse', {cx:120, cy:222, rx:59, ry:8, fill:P.forest}),
        svgEl('path', {d:'M62,236 L178,236 L165,290 Q163,297 155,297 L85,297 Q77,297 75,290 Z', fill:P.terra, stroke:INK, strokeWidth:SW, strokeLinejoin:'round'}),
        svgEl('rect', {x:54, y:212, width:132, height:24, rx:7, fill:P.terra, stroke:INK, strokeWidth:SW}),
        svgEl('line', {x1:60, y1:236, x2:180, y2:236, stroke:INK, strokeWidth:SW, opacity:0.35})
      );
    };

    var droop = expr === 'tired';

    var stem = function (topY) {
      // when tired the stalk sags and bows to one side before straightening into the pot
      var d = droop
        ? 'M112,' + (topY+6) + ' C96,' + (topY+34) + ' 108,' + (topY+78) + ' 120,222'
        : 'M120,' + topY + ' C127,' + (topY+40) + ' 113,' + (topY+80) + ' 120,222';
      return svgEl('g', {},
        svgEl('path', {d:d, fill:'none', stroke:INK, strokeWidth:15, strokeLinecap:'round'}),
        svgEl('path', {d:d, fill:'none', stroke:P.sageDeep, strokeWidth:10, strokeLinecap:'round'})
      );
    };

    var leaf = function (key, d, vein) {
      return svgEl('g', {},
        svgEl('path', {d:d, fill:P.sageDeep, stroke:INK, strokeWidth:SW, strokeLinejoin:'round'}),
        svgEl('path', {d:vein, fill:'none', stroke:P.forest, strokeWidth:2.2, strokeLinecap:'round', opacity:0.6})
      );
    };

    // ---------- assemble per stage ----------
    var body = [];
    if (stage === 1) {
      // sprout -- small & simple
      body = [
        svgEl('path', {d:'M120,224 C122,214 118,208 120,200', fill:'none', stroke:INK, strokeWidth:12, strokeLinecap:'round'}),
        svgEl('path', {d:'M120,224 C122,214 118,208 120,200', fill:'none', stroke:P.sageDeep, strokeWidth:7, strokeLinecap:'round'}),
        leaf('lc','M120,204 C104,196 90,200 86,212 C99,218 116,216 120,204 Z','M116,208 Q102,208 92,211'),
        leaf('rc','M120,200 C136,190 150,193 155,205 C142,212 124,211 120,200 Z','M124,204 Q138,203 149,206'),
        svgEl('circle', {cx:120, cy:197, r:5, fill:P.petal, stroke:INK, strokeWidth:2.6})
      ];
    } else if (stage === 2) {
      // bud
      body = [
        stem(150),
        leaf('l','M118,196 C98,178 78,184 71,202 C90,210 112,212 118,196 Z','M112,199 Q94,199 76,203'),
        leaf('r','M122,176 C142,160 162,166 169,184 C150,192 130,192 122,176 Z','M126,180 Q144,180 162,185'),
        // green bud with peeking petals
        svgEl('g', {},
          svgEl('path', {d:'M110,132 q-4,-8 4,-8 q6,-6 12,0 q8,0 4,8', fill:P.petal, stroke:INK, strokeWidth:2.6, strokeLinejoin:'round'}),
          svgEl('path', {d:'M120,120 C102,132 102,158 120,166 C138,158 138,132 120,120 Z', fill:P.sageDeep, stroke:INK, strokeWidth:SW, strokeLinejoin:'round'}),
          svgEl('path', {d:'M120,126 C112,136 112,152 120,160', fill:'none', stroke:P.forest, strokeWidth:2.2, opacity:0.55}),
          svgEl('path', {d:'M120,126 C128,136 128,152 120,160', fill:'none', stroke:P.forest, strokeWidth:2.2, opacity:0.55})
        )
      ];
    } else if (stage === 3) {
      // bloom -- full head at reduced scale
      var t3 = droop ? 'rotate(-20 118 146) ' : '';
      body = [
        stem(146),
        leaf('l','M118,192 C98,174 78,180 71,198 C90,206 112,208 118,192 Z','M112,195 Q94,195 76,199'),
        leaf('r','M122,172 C142,156 162,162 169,180 C150,188 130,188 122,172 Z','M126,176 Q144,176 162,181'),
        svgEl('g', {transform:t3 + 'translate(120 96) scale(0.8) translate(-120 -96)'}, headGroup(true))
      ];
    } else {
      // full bloom
      var headEl = droop
        ? svgEl('g', {transform:'rotate(-22 116 138)'}, headGroup(true))
        : headGroup(true);
      body = [
        stem(134),
        leaf('l','M118,188 C96,168 74,176 66,196 C86,204 110,206 118,188 Z','M112,192 Q92,190 74,195'),
        leaf('r','M122,166 C144,148 166,156 174,176 C154,184 130,184 122,166 Z','M126,170 Q144,170 164,176'),
        headEl
      ];
    }

    // ---------- coach variant ----------
    if (variant === 'coach') {
      var cid = 'coachclip-' + Math.random().toString(36).slice(2);
      return svgEl('svg', {viewBox:'0 0 240 240', width:'100%', height:'100%', style:{display:'block'}},
        svgEl('defs', {}, svgEl('clipPath', {id:cid}, svgEl('circle', {cx:120, cy:120, r:113}))),
        svgEl('circle', {cx:120, cy:120, r:113, fill:P.gold}),
        svgEl('g', {clipPath:'url(#' + cid + ')'},
          svgEl('g', {transform:'translate(120 128) scale(1.62) translate(-120 -92)'}, headGroup(true))
        ),
        svgEl('circle', {cx:120, cy:120, r:113, fill:'none', stroke:'#fff', strokeWidth:11})
      );
    }

    return svgEl('svg', {viewBox:'0 0 240 300', width:'100%', height:'100%', style:{display:'block', overflow:'visible'}},
      [pot(), body]
    );
  }

  window.renderSolArt = renderSolArt;

}());
