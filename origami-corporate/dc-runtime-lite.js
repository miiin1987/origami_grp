(function(){
function get(scope, path){
  path = path.trim();
  if (path === 'true') return true; if (path === 'false') return false;
  if (path === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
  if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
  var v = scope, parts = path.split('.');
  for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
  return v;
}
var HOLE = /\{\{([^}]+)\}\}/g, WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/;
function interp(s, scope){ return s.replace(HOLE, function(_, p){ var v = get(scope, p); return v == null ? '' : String(v); }); }
function child(scope, name, val, i){ var s = Object.create(scope); s[name] = val; s.$index = i; return s; }
function build(nodes, scope, out){
  for (var k = 0; k < nodes.length; k++){
    var n = nodes[k];
    if (n.nodeType === 3){ out.push(document.createTextNode(n.data.indexOf('{{') < 0 ? n.data : interp(n.data, scope))); continue; }
    if (n.nodeType !== 1) continue;
    if (n.localName === 'template' && n.hasAttribute('data-sc')){
      var kind = n.getAttribute('data-sc');
      if (kind === 'for'){
        var m = WHOLE.exec(n.getAttribute('list') || ''); var list = m ? get(scope, m[1]) : null;
        var as = n.getAttribute('as') || 'item';
        if (list && list.length) for (var i = 0; i < list.length; i++) build(n.content.childNodes, child(scope, as, list[i], i), out);
      } else {
        var m2 = WHOLE.exec(n.getAttribute('value') || '');
        if (m2 && get(scope, m2[1])) build(n.content.childNodes, scope, out);
      }
      continue;
    }
    var el = document.importNode(n, false), ev = {};
    var attrs = Array.prototype.slice.call(n.attributes);
    for (var a = 0; a < attrs.length; a++){
      var name = attrs[a].name, val = attrs[a].value;
      if (name.indexOf('hint-') === 0){ el.removeAttribute(name); continue; }
      var w = WHOLE.exec(val);
      if (name.length > 2 && name.indexOf('on') === 0){ el.removeAttribute(name); if (w){ ev[name.slice(2)] = get(scope, w[1]); } continue; }
      if (val.indexOf('{{') < 0) continue;
      if (w){ var v = get(scope, w[1]); if (v === false || v == null) el.removeAttribute(name); else el.setAttribute(name, v === true ? '' : String(v)); }
      else el.setAttribute(name, interp(val, scope));
    }
    el.__ev = ev;
    var kids = []; build(n.localName === 'template' ? n.content.childNodes : n.childNodes, scope, kids);
    for (var c = 0; c < kids.length; c++) el.appendChild(kids[c]);
    out.push(el);
  }
  return out;
}
function bindEv(el, ev){
  el.__ev = ev || {};
  for (var t in el.__ev){ if (!el['__l_' + t]){ el['__l_' + t] = true; (function(t){ el.addEventListener(t, function(e){ var f = el.__ev[t]; if (typeof f === 'function') f(e); }); })(t); } }
}
function morph(parent, next){
  var old = parent.childNodes;
  for (var i = 0; i < next.length; i++){
    var o = old[i], n = next[i];
    if (!o){ parent.appendChild(n); deepBind(n); continue; }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName){ parent.replaceChild(n, o); deepBind(n); continue; }
    if (o.nodeType === 3){ if (o.data !== n.data) o.data = n.data; continue; }
    var oa = o.attributes, na = n.attributes, j;
    for (j = oa.length - 1; j >= 0; j--){ if (!n.hasAttribute(oa[j].name)) o.removeAttribute(oa[j].name); }
    for (j = 0; j < na.length; j++){ if (o.getAttribute(na[j].name) !== na[j].value) o.setAttribute(na[j].name, na[j].value); }
    bindEv(o, n.__ev);
    morph(o, Array.prototype.slice.call(n.childNodes));
  }
  while (old.length > next.length) parent.removeChild(parent.lastChild);
}
function deepBind(n){ if (n.nodeType !== 1) return; bindEv(n, n.__ev); for (var c = n.firstElementChild; c; c = c.nextElementSibling) deepBind(c); }
function DCLogic(props){ this.props = props || {}; this.state = {}; }
DCLogic.prototype.setState = function(u, cb){ var s = typeof u === 'function' ? u(this.state, this.props) : u; this.state = Object.assign({}, this.state, s); this.__schedule(); if (cb) cb(); };
DCLogic.prototype.forceUpdate = function(){ this.__schedule(); };
window.DCLogic = DCLogic;
window.__dcMount = function(Component, props){
  var tpl = document.getElementById('dc-template').content;
  var root = document.getElementById('app');
  var inst = new Component(props), pending = false;
  function render(){ pending = false; morph(root, build(tpl.childNodes, inst.renderVals() || {}, [])); }
  inst.__schedule = function(){ if (!pending){ pending = true; requestAnimationFrame(render); } };
  render();
  if (inst.componentDidMount) inst.componentDidMount();
  window.addEventListener('pagehide', function(){ if (inst.componentWillUnmount) inst.componentWillUnmount(); });
};
})();
