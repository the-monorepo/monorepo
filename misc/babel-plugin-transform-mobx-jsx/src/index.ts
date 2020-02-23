import { declare } from '@babel/helper-plugin-utils';
import jsx from '@babel/plugin-syntax-jsx';
import helper from '@babel/helper-builder-react-jsx';
import { JSXElement, JSXText } from '@babel/types';
import * as core from '@babel/core';
import * as t from '@babel/types';
import { JSXExpressionContainer } from '@babel/types';

import * as tr from '@babel/traverse';

const mbxMemberExpression = (field: string) => {
  return t.memberExpression(t.identifier('mbx'), t.identifier(field));
};

const mbxCallExpression = (functionName: string, args: Parameters<typeof t.callExpression>[1]) => {
  return t.callExpression(mbxMemberExpression(functionName), args);
};

const attributeLiteralToHTMLAttributeString = (field: AttributeField) => {
  const { key: name, expression: literalPath } = field;
  // TODO: Refactor
  const literal = literalPath.node;
  if (literal === false) {
    /*
      To represent a false value, the attribute has to be omitted altogether.
      @see https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes
    */
    return '';
  }
  if (literal === null) {
    // This is like <element attrName/>
    return `${name}`;
  }
  switch (literal.type) {
    case 'StringLiteral':
      return `${name}="${literal.value.replace(/"/g, '\\"')}"`;
    case 'BooleanLiteral':
      return literal.value ? name : '';
    case 'NumericLiteral':
      return `${name}="${literal.value}"`;
    case 'TemplateLiteral':
      return literal.quasis[0];
    default:
      return `${name}="${literal.value.toString()}"`;
  }
};

const TEXT_TYPE = 'text';
const DYNAMIC_TYPE = 'dynamic';
const ELEMENT_TYPE = 'element';
const SUBCOMPONENT_TYPE = 'subcomponent';

const PROPERTY_TYPE = 'property';
const SPREAD_TYPE = 'spread';
const EVENT_TYPE = 'event';
const ATTRIBUTE_TYPE = 'attribute';

type JSXChildrenNode = t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment;

type PropertyField = {
  type: typeof PROPERTY_TYPE;
  key: string;
  expression: tr.NodePath<Exclude<t.JSXAttribute['value'] | t.JSXExpressionContainer['expression'], t.JSXExpressionContainer>>;
  setterId: any;
};
type SpreadField = {
  type: typeof SPREAD_TYPE;
  expression: tr.NodePath<t.Expression>;
};
type EventField = {
  type: typeof EVENT_TYPE;
  key: string;
  expression: tr.NodePath<Exclude<t.JSXAttribute['value'] | t.JSXExpressionContainer['expression'], t.JSXExpressionContainer>>;
};
type AttributeField = {
  type: typeof ATTRIBUTE_TYPE;
  key: string;
  expression: tr.NodePath<Exclude<t.JSXAttribute['value'] | t.JSXExpressionContainer['expression'], t.JSXExpressionContainer>>;
};
type ElementField = AttributeField | PropertyField | EventField; // TODO: SpreadType

/**
 * We have no idea how many node will be in this section.
 * Could be 0, could be 100
 */
type DynamicSection = {
  type: typeof DYNAMIC_TYPE;
  expression: tr.NodePath;
};
/**
 * Just a typical HTML/XML element
 */
type ElementNode = {
  type: typeof ELEMENT_TYPE;
  tag: string;
  children: Node[];
  fields: ElementField[];
  id: t.Identifier | null;
};

const SUBCOMPONENT_PROPERTY_TYPE = 'subcomponent_property';
type SubcomponentPropertyField = {
  type: typeof SUBCOMPONENT_PROPERTY_TYPE;
  key: string;
  expression: tr.NodePath<t.Expression | null>;
};

type SubcomponentField = SubcomponentPropertyField | SpreadField;

/**
 * Represents things like:
 * <Subcomponent><child>...</child>...</SubComponent>
 * Note that this is similar to a DynamicSection in that we have
 * no idea how many root nodes the subcomponent represents:
 * Could be 0, could 100
 */
type SubcomponentNode = {
  type: typeof SUBCOMPONENT_TYPE;
  nameExpression: tr.NodePath<t.JSXOpeningElement['name']>; // TODO
  children: Node[];
  childrenTemplateId: any;
  fields: SubcomponentField[];
};
/**
 * Just a text node
 */
type TextNode = {
  type: typeof TEXT_TYPE;
  text: string;
  id: t.Identifier | null;
};
type Node = DynamicSection | ElementNode | TextNode | SubcomponentNode;

export default declare((api, options) => {
  api.assertVersion(7);

  function domNodeFromJSXText(
    path: tr.NodePath<JSXText>,
    previousIsDynamic: boolean,
    scope,
  ) {
    return domNodeFromString(path.node.value, previousIsDynamic, scope);
  }

  const isElementTag = (tag: string) => {
    return tag[0].toLowerCase() === tag[0];
  };

  const isLiteral = (value: tr.NodePath<any>): boolean => {
    return value.node !== undefined && value.node !== null &&
      value.node.type.match(/Literal$/) !== null &&
      (!value.isTemplateLiteral() || value.node.expressions.length <= 0);
  }

  /*const isStatic = value => {
    return (
      value &&
      (isLiteral(value) ||
        t.isArrowFunctionExpression(value) ||
        t.isFunctionExpression(value))
    );
  };*/

  const fieldType = (name: string) => {
    return name.match(/^\$\$/)
      ? EVENT_TYPE
      : name.match(/^\$/)
      ? PROPERTY_TYPE
      : ATTRIBUTE_TYPE;
  };

  const findProgramAndOuterPath = (path: tr.NodePath) => {
    const parent = path.parentPath;
    if (!parent) {
      return { program: path };
    } else {
      const result = findProgramAndOuterPath(parent);
      if (result.path) {
        return result;
      } else {
        return { program: result.program, path: path };
      }
    }
  };

  const isRootJSXNode = (path: tr.NodePath) => {
    const parent = path.parentPath;

    if (parent.isJSXFragment() || parent.isJSXElement()) {
      return false;
    } else if (parent.isJSXExpressionContainer()) {
      // TODO: Very confusing condition
      return isRootJSXNode(parent);
    } else {
      return true;
    }
  };

  const cleanFieldName = (name: string) => name.replace(/^\$?\$?/, '');

  const valueExpressionFromJsxAttributeValue = (valuePath: tr.NodePath<t.JSXAttribute['value']>): tr.NodePath<t.JSXAttribute['value'] | Exclude<t.JSXExpressionContainer['expression'], t.JSXExpressionContainer>>  => {
    let current: tr.NodePath<t.JSXAttribute['value'] | t.JSXExpressionContainer['expression']> = valuePath;
    while(current.isJSXExpressionContainer()) {
      current = valuePath.get('expression');
    }
    return current as any;
  }

  const domNodesFromJSXChildren = (
    jsxChildrenPaths: tr.NodePath<JSXChildrenNode>[],
    scope: tr.Scope,
    outerPath: tr.NodePath,
  ) => {
    const children: Node[] = [];
    let previousChildIsDynamic = false;
    for (const childPath of jsxChildrenPaths) {
      for (const node of yieldDomNodeFromNodeSimplified(
        childPath,
        previousChildIsDynamic,
        scope,
        outerPath,
      )) {
        previousChildIsDynamic = isDynamicDomlessNode(node);
        children.push(node);
      }
    }
    return children;
  };

  const hasDynamicNodes = (children: Node[]) => {
    return children.some(
      childNode =>
        childNode.type === DYNAMIC_TYPE ||
        (childNode.type === ELEMENT_TYPE && childNode.id) ||
        SUBCOMPONENT_TYPE,
    );
  };

  const domNodeFromJSXElement = (
    path: tr.NodePath<JSXElement>,
    previousIsDynamic: boolean,
    scope: tr.Scope,
    outerPath: tr.NodePath,
  ): SubcomponentNode | ElementNode => {
    const jsxOpeningElementPath = path.get('openingElement');
    const jsxAttributePathsOrPath = jsxOpeningElementPath.get('attributes');
    const jsxAttributePaths = Array.isArray(jsxAttributePathsOrPath) ? jsxAttributePathsOrPath : [ jsxAttributePathsOrPath ];
    const jsxOpeningElementNamePath = jsxOpeningElementPath.get('name');
    if (
      jsxOpeningElementNamePath.isJSXIdentifier() &&
      isElementTag(jsxOpeningElementNamePath.node.name)
    ) {
      const tag = jsxOpeningElementNamePath.node.name;
      const potentialId = scope.generateUidIdentifier(`${tag}$`);
      const fields: ElementField[] = jsxAttributePaths.map(
        (jsxAttributePath): ElementField => {
          if (jsxAttributePath.isJSXSpreadAttribute()) {  
            throw new Error('Not supported');
          } else if (jsxAttributePath.isJSXAttribute()) {
            const namePath = jsxAttributePath.get('name');
            const valuePath = jsxAttributePath.get('value');
            if (namePath.isJSXNamespacedName()) {
              throw new Error('Not supported');
            } else if (namePath.isJSXIdentifier()) {
              const type = fieldType(namePath.node.name);
              switch (type) {
                case PROPERTY_TYPE:
                  const key = cleanFieldName(namePath.node.name);
                  const setterId = (() => {
                    if (setterMap.has(key)) {
                      return setterMap.get(key)!;
                    } else {
                      const id = outerPath.scope.generateUidIdentifier(`${key}$setter`);
                      const elementId = outerPath.scope.generateUidIdentifier('element');
                      const valueId = outerPath.scope.generateUidIdentifier('value');
    
                      outerPath.insertBefore(
                        constDeclaration(
                          id,
                          t.arrowFunctionExpression(
                            [elementId, valueId],
                            t.assignmentExpression(
                              '=',
                              t.memberExpression(elementId, t.identifier(key)),
                              valueId,
                            ),
                          ),
                        ),
                      );
                      setterMap.set(key, id);
                      return id;
                    }
                  })();
                  return {
                    type,
                    setterId,
                    expression: valueExpressionFromJsxAttributeValue(valuePath),
                    key,
                  };
                default:
                  return {
                    type,
                    key: cleanFieldName(namePath.node.name),
                    expression: valueExpressionFromJsxAttributeValue(valuePath),
                  } as ElementField;
              }  
            }
          }
          throw new Error('Not supported');
        },
      );
      const children = domNodesFromJSXChildren(path.get('children'), scope, outerPath);
      const childrenAreDynamic = hasDynamicNodes(children);
      const nonStaticAttributeFields = fields.filter(
        field => !(field.type === ATTRIBUTE_TYPE && isLiteral(field.expression)),
      );
      console.log('heh', children)
      const resultNode: ElementNode = {
        type: ELEMENT_TYPE,
        tag,
        children,
        fields,
        id:
          previousIsDynamic || childrenAreDynamic || nonStaticAttributeFields.length > 0
            ? potentialId
            : null,
      };
      return resultNode;
    } else {
      const fields: SubcomponentField[] = jsxAttributePaths.map(
        (jsxAttributePath): SubcomponentField => {
          if (jsxAttributePath.isJSXSpreadAttribute()) {
            const result: SpreadField = {
              type: SPREAD_TYPE,
              expression: jsxAttributePath.get('argument'), // TODO: Check this is right
            };
            return result;
          } else if (jsxAttributePath.isJSXAttribute()) {
            const namePath = jsxAttributePath.get('name');
            if (namePath.isJSXNamespacedName()) {
              throw new Error('Not supported');
            } else if (namePath.isJSXIdentifier()) {
              const result: SubcomponentPropertyField = {
                type: SUBCOMPONENT_PROPERTY_TYPE,
                key: namePath.node.name,
                expression: valueExpressionFromJsxAttributeValue(
                  jsxAttributePath.get('value'),
                ),
              };
              return result;  
            }
          }
          throw new Error('Not supported');
        },
      );
      const children = domNodesFromJSXChildren(path.get('children'), scope, outerPath);

      const resultNode: SubcomponentNode = {
        type: SUBCOMPONENT_TYPE,
        nameExpression: jsxOpeningElementPath.get('name'),
        children,
        childrenTemplateId:
          children.length > 0 ? scope.generateUidIdentifier('subTemplate') : null,
        fields,
      };
      console.log(resultNode.nameExpression.node, resultNode.children.length, resultNode.childrenTemplateId)
      return resultNode;
    }
  };

  const domNodeFromString = (
    aString: string,
    previousIsDynamic: boolean,
    scope: tr.Scope,
  ): TextNode | null => {
    const html = aString.replace(/^\s*\n\s*|\s*\n\s*$/g, '');
    if (html === '') {
      return null;
    }
    return {
      type: TEXT_TYPE,
      text: html,
      id: previousIsDynamic ? scope.generateUidIdentifier('text') : null,
    };
  };

  const isDynamicDomlessNode = (node: Node) => {
    return node.type === DYNAMIC_TYPE || node.type === SUBCOMPONENT_TYPE;
  };

  function* yieldDomNodeFromJSXFragment(
    path: tr.NodePath<t.JSXFragment>,
    previousIsDynamic: boolean,
    scope,
    outerPath,
  ) {
    for (const childPath of path.get('children')) {
      for (const node of yieldDomNodeFromNodeSimplified(
        childPath,
        previousIsDynamic,
        scope,
        outerPath,
      )) {
        previousIsDynamic = isDynamicDomlessNode(node);
        yield node;
      }
    }
  }

  function* yieldDomNodeFromJSXExpressionContainerNode(
    path: tr.NodePath<JSXExpressionContainer>,
    previousIsDynamic: boolean,
    scope,
    outerPath,
  ): IterableIterator<Node> {
    const expressionPath = path.get('expression');
    // TODO: Function and array literals
    if (expressionPath.isJSXElement() || expressionPath.isJSXFragment()) {
      yield* yieldDomNodeFromNodeSimplified(
        expressionPath,
        previousIsDynamic,
        scope,
        outerPath,
      );
    } else if (expressionPath.isStringLiteral()) {
      // TODO: Two contained literals next to each other would lead to incorrect state length
      const textNode = domNodeFromString(
        expressionPath.node.value,
        previousIsDynamic,
        scope,
      );
      if (textNode) {
        yield textNode;
      }
    } else if (expressionPath.isNumericLiteral() || expressionPath.isBooleanLiteral()) {
      const textNode = domNodeFromString(
        expressionPath.node.value.toString(),
        previousIsDynamic,
        scope,
      );
      if (textNode) {
        yield textNode;
      }
    } else {
      yield {
        type: DYNAMIC_TYPE,
        expression: expressionPath,
      };
    }
  }

  function* yieldDomNodeFromNodeNonSimplified(
    path: tr.NodePath<JSXElement['children'][0]>,
    previousIsDynamic,
    scope,
    outerPath,
  ): IterableIterator<Node> {
    if (path.isJSXElement()) {
      yield domNodeFromJSXElement(path, previousIsDynamic, scope, outerPath);
    } else if (path.isJSXExpressionContainer()) {
      yield* yieldDomNodeFromJSXExpressionContainerNode(
        path,
        previousIsDynamic,
        scope,
        outerPath,
      );
    } else if (path.isJSXFragment()) {
      yield* yieldDomNodeFromJSXFragment(path, previousIsDynamic, scope, outerPath);
    } else if (path.isJSXText()) {
      const textNode = domNodeFromJSXText(path, previousIsDynamic, scope);
      if (textNode) {
        yield textNode;
      }
    } else {
      throw new Error(`Invalid node type ${path.node.type}`);
    }
  }

  function* yieldDomNodeFromNodeSimplified(
    path: tr.NodePath<JSXChildrenNode>,
    previousIsDynamic: boolean,
    scope,
    outerPath,
  ): IterableIterator<Node> {
    const domNodeIterator = yieldDomNodeFromNodeNonSimplified(
      path,
      previousIsDynamic,
      scope,
      outerPath,
    );
    let previous = domNodeIterator.next();
    if (!previous.done) {
      if (previous.value.type !== TEXT_TYPE) {
        yield previous.value;
      }
      let current = domNodeIterator.next();
      while (!current.done) {
        if (previous.value.type === TEXT_TYPE && current.value.type === TEXT_TYPE) {
          // If there's two text nodes you can just concacatinate them
          previous.value.text += current.value.text;
          current = domNodeIterator.next();
        } else if (previous.value.type === TEXT_TYPE) {
          yield previous.value;
        } else {
          yield current.value;
          previous = current;
          current = domNodeIterator.next();
        }
      }
      if (previous.value.type === TEXT_TYPE) {
        yield previous.value;
      }
    }
  }

  const htmlFromNode = (node: Node): string => {
    switch (node.type) {
      case ELEMENT_TYPE:
        const tag: string = node.tag;
        const attributeString: string = (node.fields.filter(
          field => field.type === ATTRIBUTE_TYPE && isLiteral(field.expression),
        ) as AttributeField[])
          .map(field => attributeLiteralToHTMLAttributeString(field))
          .join(' ');
        const childrenString: string = node.children
          .map(field => {
            return htmlFromNode(field);
          })
          .join('');
        return `<${tag}${
          attributeString !== '' ? ` ${attributeString}` : ''
        }>${childrenString}</${tag}>`;
      case TEXT_TYPE:
        return node.text;
      default:
        return '';
    }
  };

  const constDeclaration = (id, expression) => {
    return t.variableDeclaration('const', [t.variableDeclarator(id, expression)]);
  };

  const STATIC_ELEMENT_TEMPLATE_FACTORY_NAME = 'staticElementBlueprint';
  const DYNAMIC_ELEMENT_TEMPLATE_FACTORY_NAME = 'elementBlueprint';
  const STATIC_FRAGMENT_TEMPLATE_FACTORY_NAME = 'staticFragmentBlueprint';
  const DYNAMIC_FRAGMENT_TEMPLATE_FACTORY_NAME = 'fragmentBlueprint';

  function* yieldDeclarationStatementsFromRootNodes(
    nodes: Node[],
    rootId: any,
    isRoot: boolean,
  ) {
    const childrenWithDomNodesAssociatedWithThem: ElementNode[] = nodes.filter(
      child => child.type === ELEMENT_TYPE,
    ) as ElementNode[];

    if (childrenWithDomNodesAssociatedWithThem.length > 0) {
      const firstNode = childrenWithDomNodesAssociatedWithThem[0];
      if (firstNode.id) {
        if (isRoot && childrenWithDomNodesAssociatedWithThem.length === 1) {
          yield constDeclaration(firstNode.id, rootId);
        } else {
          yield constDeclaration(
            firstNode.id,
            t.memberExpression(rootId, t.identifier('firstChild')),
          );
        }
        yield* yieldDeclarationStatementsFromRootNodes(
          firstNode.children,
          firstNode.id,
          false,
        );
      }
      for (let c = 1; c < childrenWithDomNodesAssociatedWithThem.length - 1; c++) {
        const childNode = childrenWithDomNodesAssociatedWithThem[c];
        if (childNode.id) {
          const previousNode = childrenWithDomNodesAssociatedWithThem[c - 1];
          if (previousNode.id) {
            yield constDeclaration(
              childNode.id,
              t.memberExpression(previousNode.id, t.identifier('nextSibling')),
            );
          } else {
            yield constDeclaration(
              childNode.id,
              t.memberExpression(
                t.memberExpression(rootId, t.identifier('childNodes')),
                t.numericLiteral(c),
                true,
              ),
            );
          }
          yield* yieldDeclarationStatementsFromRootNodes(
            childNode.children,
            childNode.id,
            false,
          );
        }
      }
      // TODO: Could do previousSibling if the last node uses lastChild
      if (childrenWithDomNodesAssociatedWithThem.length >= 2) {
        const lastNode =
          childrenWithDomNodesAssociatedWithThem[
            childrenWithDomNodesAssociatedWithThem.length - 1
          ];
        if (lastNode.id) {
          yield constDeclaration(
            lastNode.id,
            t.memberExpression(rootId, t.identifier('lastChild')),
          );
          yield* yieldDeclarationStatementsFromRootNodes(
            lastNode.children,
            lastNode.id,
            false,
          );
        }
      }
    }
  }

  const dynamicFieldExpression = (
    rootId,
    beforeId,
    previousConsecutiveDynamicNodeCount: number,
  ) => {
    if (previousConsecutiveDynamicNodeCount === 1) {
      return mbxCallExpression('children', [rootId, beforeId]);
    } else if (previousConsecutiveDynamicNodeCount >= 2) {
      return mbxCallExpression('dynamicSection', [
        rootId,
        beforeId,
        t.numericLiteral(previousConsecutiveDynamicNodeCount),
      ]);
    }
    return null;
  };

  function* yieldFieldExpressionsFromNodes(nodes: Node[], rootId: t.Identifier) {
    let previousConsecutiveDynamicNodeCount = 0;
    for (const node of nodes) {
      switch (node.type) {
        case TEXT_TYPE:
        case ELEMENT_TYPE:
          const dynamicExpression = dynamicFieldExpression(
            rootId,
            node.id,
            previousConsecutiveDynamicNodeCount,
          );
          if (dynamicExpression !== null) {
            yield dynamicExpression;
          }
          previousConsecutiveDynamicNodeCount = 0;
          if (node.type === ELEMENT_TYPE) {
            for (const field of node.fields) {
              switch (field.type) {
                case EVENT_TYPE:
                case ATTRIBUTE_TYPE:
                  if (!isLiteral(field.expression)) {
                    if (node.id === null) {
                      throw new Error('Not supported');
                    }
          
                    yield mbxCallExpression(field.type, [
                      node.id,
                      t.stringLiteral(field.key),
                    ]);
                  }
                  break;
                case PROPERTY_TYPE:
                  yield mbxCallExpression(field.type, [node.id, field.setterId]);
                  break;
              }
            }
            if (node.id !== null) {
              yield* yieldFieldExpressionsFromNodes(node.children, node.id);
            }  
          }
          break;
        case SUBCOMPONENT_TYPE:
        case DYNAMIC_TYPE:
          previousConsecutiveDynamicNodeCount++;
          break;
      }
    }
    const dynamicExpression = dynamicFieldExpression(
      rootId,
      t.identifier('null'),
      previousConsecutiveDynamicNodeCount,
    );
    if (dynamicExpression !== null) {
      yield dynamicExpression;
    }
  }

  function* yieldFieldValuesFromNode(node: Node): Generator<t.Node | null> {
    switch (node.type) {
      case ELEMENT_TYPE:
        for (const field of node.fields) {
          switch (field.type) {
            case ATTRIBUTE_TYPE:
              if (!isLiteral(field.expression)) {
                yield field.expression.node;
              }
              break;
            default:
              yield field.expression.node;
          }
        }
        for (const childNode of node.children) {
          yield* yieldFieldValuesFromNode(childNode);
        }
        break;
      case DYNAMIC_TYPE:
        yield node.expression.node;
        break;
      case SUBCOMPONENT_TYPE:
        const objectProperties: any[] = [];
        for (const field of node.fields) {
          switch (field.type) {
            case SPREAD_TYPE:
              objectProperties.push(field.expression.node);
              break;
            case SUBCOMPONENT_PROPERTY_TYPE:
              if (field.expression.node === null) {
                throw new Error('Not supported');
              }
              objectProperties.push(
                t.objectProperty(t.identifier(field.key), field.expression.node),
              );
              break;
          }
        }
        if (node.childrenTemplateId) {
          const childArgs: Parameters<typeof t.callExpression>[1] = [node.childrenTemplateId];
          for (const childNode of node.children) {
            childArgs.push(...yieldFieldValuesFromNode(childNode));
          }
          objectProperties.push(
            t.objectProperty(
              t.identifier('children'),
              mbxCallExpression('componentResult', childArgs),
            ),
          );
        }
        // TODO: This whole block of code assumes that it's a SFC and not a string (representing an HTML element)
        if (!node.nameExpression.isJSXIdentifier()) {
          throw new Error('Not supported');
        }
        yield t.callExpression(t.identifier(node.nameExpression.node.name), [
          t.objectExpression(objectProperties),
        ]);
    }
  }

  const nodeHasDom = (node: Node) =>
    node.type === ELEMENT_TYPE || node.type === TEXT_TYPE;

  function* yieldTemplateInfoFromRootNodes(nodes: Node[], templateId, scope) {
    console.log();
    const nodeStack: Node[] = [...nodes];
    const dynamicNodes: (ElementNode | SubcomponentNode | DynamicSection)[] = [];
    while (nodeStack.length > 0) {
      const node = nodeStack.pop()!;
      switch(node.type) {
        case SUBCOMPONENT_TYPE:
          yield* yieldTemplateInfoFromSubcomponentNode(node, scope);
          dynamicNodes.push(node);
          nodeStack.push(...node.children)
          break;
        case DYNAMIC_TYPE:
          dynamicNodes.push(node);
          break;
        case ELEMENT_TYPE:
          if (node.id !== null) {
            dynamicNodes.push(node);
          }
          nodeStack.push(...node.children);
          break;
      }
    }
    const subcomponentNodes: SubcomponentNode[] = nodes.filter(
      node => node.type === SUBCOMPONENT_TYPE,
    ) as SubcomponentNode[];
    console.log(nodes);
    for (const subcomponentNode of subcomponentNodes) {
      console.log('sbcomponent')
      yield* yieldTemplateInfoFromSubcomponentNode(subcomponentNode, scope);
    }

    const nodesWithDom: (ElementNode | TextNode)[] = nodes.filter(nodeHasDom) as (
      | ElementNode
      | TextNode
    )[];
    const dynamicElementLength = dynamicNodes.length;
    const args: Parameters<typeof t.callExpression>[1] = [t.stringLiteral(nodes.map(node => htmlFromNode(node)).join(''))];
    let templateMethod: string;
    if (nodesWithDom.length <= 0) {
      return;
    } else if (nodesWithDom.length === 1) {
      if (dynamicElementLength > 0) {
        templateMethod = DYNAMIC_ELEMENT_TEMPLATE_FACTORY_NAME;
      } else {
        templateMethod = STATIC_ELEMENT_TEMPLATE_FACTORY_NAME;
      }
    } else {
      if (dynamicElementLength > 0) {
        templateMethod = DYNAMIC_FRAGMENT_TEMPLATE_FACTORY_NAME;
      } else {
        templateMethod = STATIC_FRAGMENT_TEMPLATE_FACTORY_NAME;
      }
    }
    if (dynamicElementLength > 0) {
      const rootParamId = scope.generateUidIdentifier('rootNode');
      const statements = [
        ...yieldDeclarationStatementsFromRootNodes(nodes, rootParamId, true),
      ];
      const fieldExpressions = [...yieldFieldExpressionsFromNodes(nodes, rootParamId)];
      statements.push(t.returnStatement(t.arrayExpression(fieldExpressions)));

      const blockStatement = t.blockStatement(statements);
      const arrowFunction = t.arrowFunctionExpression([rootParamId], blockStatement);
      args.push(arrowFunction);
    }
    yield constDeclaration(templateId, mbxCallExpression(templateMethod, args));
  }

  function* yieldTemplateInfoFromSubcomponentNode(node: SubcomponentNode, scope) {
    if (node.childrenTemplateId) {
      yield* yieldTemplateInfoFromRootNodes(
        node.children,
        node.childrenTemplateId,
        scope,
      );
    }
  }

  const replacePathWithDomNodeSyntax = (nodes: Node[], path: tr.NodePath, outerPath: tr.NodePath) => {
    const templateId = path.scope.generateUidIdentifier('template');
    const templateDeclarations = yieldTemplateInfoFromRootNodes(
      nodes,
      templateId,
      path.scope,
    );
    for (const statement of templateDeclarations) {
      outerPath.insertBefore(statement);
    }
    const nodesWithDom = nodes.filter(nodeHasDom);
    if (nodesWithDom.length <= 0) {
      const componentResultArgs: any[] = [];
      for (const node of nodes) {
        componentResultArgs.push(...yieldFieldValuesFromNode(node));
      }
      if (componentResultArgs.length === 1) {
        path.replaceWith(t.expressionStatement(componentResultArgs[0]));
      } else {
        path.replaceWith(t.expressionStatement(t.arrayExpression(componentResultArgs)));
      }
    } else {
      const componentResultArgs: Parameters<typeof t.callExpression>[1] = [templateId];
      for (const node of nodes) {
        const fieldValues = t.arrayExpression([...yieldFieldValuesFromNode(node)]);
        componentResultArgs.push(fieldValues);
      }
      path.replaceWith(
        t.expressionStatement(mbxCallExpression('componentResult', componentResultArgs)),
      );
    }
  };

  const THROW_IF_NAMESPACE =
    options.throwIfNamespace === undefined ? true : !!options.throwIfNamespace;

  const PRAGMA_DEFAULT = options.pragma || 'mbx.createElement';
  const PRAGMA_FRAG_DEFAULT = options.pragmaFrag || 'mbx.Fragment';

  const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/;
  const JSX_FRAG_ANNOTATION_REGEX = /\*?\s*@jsxFrag\s+([^\s]+)/;

  // returns a closure that returns an identifier or memberExpression node
  // based on the given id
  const createIdentifierParser = (id: string) => () => {
    const identifiers = id.split('.')
      .map(name => t.identifier(name));
    let cur: t.Identifier | t.MemberExpression = identifiers[0];
    for(let i = 1; i < identifiers.length; i++) {
      cur = t.memberExpression(cur, identifiers[i]);
    }
    return cur;
  };

  // TODO: Type it properly
  let setterMap: Map<string, any>;
  const visitor = helper({
    pre(state) {
      const tagName = state.tagName;
      const args = state.args;
      if (core.types.react.isCompatTag(tagName)) {
        args.push(t.stringLiteral(tagName));
      } else {
        args.push(state.tagExpr);
      }
    },

    post(state, pass) {
      state.callee = pass.get('jsxIdentifier')();
    },

    throwIfNamespace: THROW_IF_NAMESPACE,
  });

  visitor.Program = {
    enter(path, state) {
      setterMap = new Map();
      const { file } = state;
      //path.unshift(t.memberExpression(t.identifier('swek'), t.identifier(1)));
      let pragma = PRAGMA_DEFAULT;
      let pragmaFrag = PRAGMA_FRAG_DEFAULT;
      let pragmaSet = !!options.pragma;
      let pragmaFragSet = !!options.pragmaFrag;

      if (file.ast.comments) {
        for (const comment of file.ast.comments) {
          const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value);
          if (jsxMatches) {
            pragma = jsxMatches[1];
            pragmaSet = true;
          }
          const jsxFragMatches = JSX_FRAG_ANNOTATION_REGEX.exec(comment.value);
          if (jsxFragMatches) {
            pragmaFrag = jsxFragMatches[1];
            pragmaFragSet = true;
          }
        }
      }

      state.set('jsxIdentifier', createIdentifierParser(pragma));
      state.set('jsxFragIdentifier', createIdentifierParser(pragmaFrag));
      state.set('usedFragment', false);
      state.set('pragmaSet', pragmaSet);
      state.set('pragmaFragSet', pragmaFragSet);
    },
    exit(path, state) {
      if (
        state.get('pragmaSet') &&
        state.get('usedFragment') &&
        !state.get('pragmaFragSet')
      ) {
        throw new Error(
          'transform-react-jsx: pragma has been set but ' + 'pragmafrag has not been set',
        );
      }
    },
  };

  visitor.JSXFragment = function(path: tr.NodePath<t.JSXFragment>) {
    if (isRootJSXNode(path)) {
      const outerPath = path.findParent(
        parentPath => parentPath === undefined || parentPath.parentPath.isProgram(),
      );
      const domNodes = [
        ...yieldDomNodeFromJSXFragment(path, false, path.scope, outerPath),
      ];
      replacePathWithDomNodeSyntax(domNodes, path, outerPath);
    }
  };

  visitor.JSXElement = {
    exit(path) {
      if (isRootJSXNode(path)) {
        const outerPath = path.findParent(
          parentPath => parentPath === undefined || parentPath.parentPath.isProgram(),
        );
        const domNode = domNodeFromJSXElement(path, false, path.scope, outerPath);
        replacePathWithDomNodeSyntax([domNode], path, outerPath);
      }
    },
  };

  return {
    name: 'transform-react-jsx',
    inherits: jsx,
    visitor,
  };
});
