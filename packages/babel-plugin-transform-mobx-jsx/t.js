import * as mbx from './mobx-dom';
import { render, repeat } from './mobx-dom';
import { createStore } from './Store';
import { observable, computed } from 'mobx';
let { store, client } = createStore();

const _template$ = mbx.elementTemplate(
  '<tr><td className="col-md-1"><!----></td><td className="col-md-4"><a><!----></a></td><td className="col-md-1"><a><span className="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td className="col-md-6"></td></tr>',
);

const Row = props =>
  (function() {
    const _root$ = _template$();

    const _td$ = _root$.childNodes[0];
    const _marker$ = _td$.childNodes[0];
    const _td$2 = _root$.childNodes[1];
    const _a$ = _td$2.childNodes[0];
    const _marker$2 = _a$.childNodes[0];

    _a$.onclick = () => {
      client.select(props.data);
    };

    const _td$3 = _root$.childNodes[2];
    const _a$2 = _td$3.childNodes[0];

    _a$2.onclick = () => client.delete(props.data.id);

    return mbx.componentRoot(_root$, [
      mbx.fields(_root$, [
        mbx.field(mbx.ATTR_TYPE, 'className', () =>
          props.data.isSelected ? 'danger' : '',
        ),
      ]),
      mbx.children(_marker$, () => props.data.id),
      mbx.children(_marker$2, () => props.data.label),
    ]);
  })();

const _template$2 = mbx.elementTemplate('<!---->');

const _template$3 = mbx.elementTemplate(
  '<div className="container"><div className="jumbotron"><div className="row"><div className="col-md-6"><h1>React + Mobx</h1></div><div className="col-md-6"><div className="row"><div className="col-sm-6 smallpad"><button type="button" className="btn btn-primary btn-block" id="run">Create 1,000 rows</button></div><div className="col-sm-6 smallpad"><button type="button" className="btn btn-primary btn-block" id="runlots">Create 10,000 rows</button></div><div className="col-sm-6 smallpad"><button type="button" className="btn btn-primary btn-block" id="add">Append 1,000 rows</button></div><div className="col-sm-6 smallpad"><button type="button" className="btn btn-primary btn-block" id="update">Update every 10th row</button></div><div className="col-sm-6 smallpad"><button type="button" className="btn btn-primary btn-block" id="clear">Clear</button></div><div className="col-sm-6 smallpad"><button type="button" className="btn btn-primary btn-block" id="swaprows">Swap Rows</button></div></div></div></div></div><table className="table table-hover table-striped test-data"><tbody><!----></tbody></table><span className="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span></div>',
);

const Main = () =>
  (function() {
    const _root$3 = _template$3();

    const _div$ = _root$3.childNodes[0];
    const _div$2 = _div$.childNodes[0];
    const _div$3 = _div$2.childNodes[0];
    const _h1$ = _div$3.childNodes[0];
    const _div$4 = _div$2.childNodes[1];
    const _div$5 = _div$4.childNodes[0];
    const _div$6 = _div$5.childNodes[0];
    const _button$ = _div$6.childNodes[0];
    const _div$7 = _div$5.childNodes[1];
    const _button$2 = _div$7.childNodes[0];
    const _div$8 = _div$5.childNodes[2];
    const _button$3 = _div$8.childNodes[0];
    const _div$9 = _div$5.childNodes[3];
    const _button$4 = _div$9.childNodes[0];
    const _div$10 = _div$5.childNodes[4];
    const _button$5 = _div$10.childNodes[0];
    const _div$11 = _div$5.childNodes[5];
    const _button$6 = _div$11.childNodes[0];
    const _table$ = _root$3.childNodes[1];
    const _tbody$ = _table$.childNodes[0];
    const _marker$3 = _tbody$.childNodes[0];
    return mbx.componentRoot(_root$3, [
      mbx.fields(_button$, [mbx.field(mbx.PROP_TYPE, 'onclick', () => client.run)]),
      mbx.fields(_button$2, [mbx.field(mbx.PROP_TYPE, 'onclick', () => client.runLots)]),
      mbx.fields(_button$3, [mbx.field(mbx.PROP_TYPE, 'onclick', () => client.add)]),
      mbx.fields(_button$4, [mbx.field(mbx.PROP_TYPE, 'onclick', () => client.update)]),
      mbx.fields(_button$5, [mbx.field(mbx.PROP_TYPE, 'onclick', () => client.clear)]),
      mbx.fields(_button$6, [mbx.field(mbx.PROP_TYPE, 'onclick', () => client.swapRows)]),
      mbx.children(_marker$3, () =>
        repeat(store.data, d =>
          (function() {
            const _root$2 = _template$2();

            return mbx.componentRoot(_root$2, [
              mbx.subComponent(Row, _root$2, undefined, [
                mbx.field(mbx.STATIC_FIELD_TYPE, 'data', d),
              ]),
            ]);
          })(),
        ),
      ),
    ]);
  })();

const _template$4 = mbx.elementTemplate('<!---->');

render(
  (function() {
    const _root$4 = _template$4();

    return mbx.componentRoot(_root$4, [
      mbx.subComponent(Main, _root$4, undefined, undefined),
    ]);
  })(),
  document.getElementById('main'),
);
