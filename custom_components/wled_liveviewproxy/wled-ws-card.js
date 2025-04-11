/**
@license
Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
part of the polymer project is also subject to an additional IP rights grant
found at http://polymer.github.io/PATENTS.txt
*/
const isCEPolyfill=typeof window!=="undefined"&&window.customElements!=null&&window.customElements.polyfillWrapFlushCallback!==undefined;const removeNodes=(container,start,end=null)=>{while(start!==end){const n=start.nextSibling;container.removeChild(start);start=n}};const marker=`{{lit-${String(Math.random()).slice(2)}}}`;const nodeMarker=`\x3c!--${marker}--\x3e`;const markerRegex=new RegExp(`${marker}|${nodeMarker}`);const boundAttributeSuffix="$lit$";class Template{constructor(result,element){this.parts=[];this.element=element;const nodesToRemove=[];const stack=[];const walker=document.createTreeWalker(element.content,133,null,false);let lastPartIndex=0;let index=-1;let partIndex=0;const{strings:strings,values:{length:length}}=result;while(partIndex<length){const node=walker.nextNode();if(node===null){walker.currentNode=stack.pop();continue}index++;if(node.nodeType===1){if(node.hasAttributes()){const attributes=node.attributes;const{length:length}=attributes;let count=0;for(let i=0;i<length;i++){if(endsWith(attributes[i].name,boundAttributeSuffix)){count++}}while(count-- >0){const stringForPart=strings[partIndex];const name=lastAttributeNameRegex.exec(stringForPart)[2];const attributeLookupName=name.toLowerCase()+boundAttributeSuffix;const attributeValue=node.getAttribute(attributeLookupName);node.removeAttribute(attributeLookupName);const statics=attributeValue.split(markerRegex);this.parts.push({type:"attribute",index:index,name:name,strings:statics});partIndex+=statics.length-1}}if(node.tagName==="TEMPLATE"){stack.push(node);walker.currentNode=node.content}}else if(node.nodeType===3){const data=node.data;if(data.indexOf(marker)>=0){const parent=node.parentNode;const strings=data.split(markerRegex);const lastIndex=strings.length-1;for(let i=0;i<lastIndex;i++){let insert;let s=strings[i];if(s===""){insert=createMarker()}else{const match=lastAttributeNameRegex.exec(s);if(match!==null&&endsWith(match[2],boundAttributeSuffix)){s=s.slice(0,match.index)+match[1]+match[2].slice(0,-boundAttributeSuffix.length)+match[3]}insert=document.createTextNode(s)}parent.insertBefore(insert,node);this.parts.push({type:"node",index:++index})}if(strings[lastIndex]===""){parent.insertBefore(createMarker(),node);nodesToRemove.push(node)}else{node.data=strings[lastIndex]}partIndex+=lastIndex}}else if(node.nodeType===8){if(node.data===marker){const parent=node.parentNode;if(node.previousSibling===null||index===lastPartIndex){index++;parent.insertBefore(createMarker(),node)}lastPartIndex=index;this.parts.push({type:"node",index:index});if(node.nextSibling===null){node.data=""}else{nodesToRemove.push(node);index--}partIndex++}else{let i=-1;while((i=node.data.indexOf(marker,i+1))!==-1){this.parts.push({type:"node",index:-1});partIndex++}}}}for(const n of nodesToRemove){n.parentNode.removeChild(n)}}}const endsWith=(str,suffix)=>{const index=str.length-suffix.length;return index>=0&&str.slice(index)===suffix};const isTemplatePartActive=part=>part.index!==-1;const createMarker=()=>document.createComment("");const lastAttributeNameRegex=/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;const walkerNodeFilter=133;function removeNodesFromTemplate(template,nodesToRemove){const{element:{content:content},parts:parts}=template;const walker=document.createTreeWalker(content,walkerNodeFilter,null,false);let partIndex=nextActiveIndexInTemplateParts(parts);let part=parts[partIndex];let nodeIndex=-1;let removeCount=0;const nodesToRemoveInTemplate=[];let currentRemovingNode=null;while(walker.nextNode()){nodeIndex++;const node=walker.currentNode;if(node.previousSibling===currentRemovingNode){currentRemovingNode=null}if(nodesToRemove.has(node)){nodesToRemoveInTemplate.push(node);if(currentRemovingNode===null){currentRemovingNode=node}}if(currentRemovingNode!==null){removeCount++}while(part!==undefined&&part.index===nodeIndex){part.index=currentRemovingNode!==null?-1:part.index-removeCount;partIndex=nextActiveIndexInTemplateParts(parts,partIndex);part=parts[partIndex]}}nodesToRemoveInTemplate.forEach((n=>n.parentNode.removeChild(n)))}const countNodes=node=>{let count=node.nodeType===11?0:1;const walker=document.createTreeWalker(node,walkerNodeFilter,null,false);while(walker.nextNode()){count++}return count};const nextActiveIndexInTemplateParts=(parts,startIndex=-1)=>{for(let i=startIndex+1;i<parts.length;i++){const part=parts[i];if(isTemplatePartActive(part)){return i}}return-1};function insertNodeIntoTemplate(template,node,refNode=null){const{element:{content:content},parts:parts}=template;if(refNode===null||refNode===undefined){content.appendChild(node);return}const walker=document.createTreeWalker(content,walkerNodeFilter,null,false);let partIndex=nextActiveIndexInTemplateParts(parts);let insertCount=0;let walkerIndex=-1;while(walker.nextNode()){walkerIndex++;const walkerNode=walker.currentNode;if(walkerNode===refNode){insertCount=countNodes(node);refNode.parentNode.insertBefore(node,refNode)}while(partIndex!==-1&&parts[partIndex].index===walkerIndex){if(insertCount>0){while(partIndex!==-1){parts[partIndex].index+=insertCount;partIndex=nextActiveIndexInTemplateParts(parts,partIndex)}return}partIndex=nextActiveIndexInTemplateParts(parts,partIndex)}}}const directives=new WeakMap;const isDirective=o=>typeof o==="function"&&directives.has(o);const noChange={};const nothing={};class TemplateInstance{constructor(template,processor,options){this.__parts=[];this.template=template;this.processor=processor;this.options=options}update(values){let i=0;for(const part of this.__parts){if(part!==undefined){part.setValue(values[i])}i++}for(const part of this.__parts){if(part!==undefined){part.commit()}}}_clone(){const fragment=isCEPolyfill?this.template.element.content.cloneNode(true):document.importNode(this.template.element.content,true);const stack=[];const parts=this.template.parts;const walker=document.createTreeWalker(fragment,133,null,false);let partIndex=0;let nodeIndex=0;let part;let node=walker.nextNode();while(partIndex<parts.length){part=parts[partIndex];if(!isTemplatePartActive(part)){this.__parts.push(undefined);partIndex++;continue}while(nodeIndex<part.index){nodeIndex++;if(node.nodeName==="TEMPLATE"){stack.push(node);walker.currentNode=node.content}if((node=walker.nextNode())===null){walker.currentNode=stack.pop();node=walker.nextNode()}}if(part.type==="node"){const part=this.processor.handleTextExpression(this.options);part.insertAfterNode(node.previousSibling);this.__parts.push(part)}else{this.__parts.push(...this.processor.handleAttributeExpressions(node,part.name,part.strings,this.options))}partIndex++}if(isCEPolyfill){document.adoptNode(fragment);customElements.upgrade(fragment)}return fragment}}const policy=window.trustedTypes&&trustedTypes.createPolicy("lit-html",{createHTML:s=>s});const commentMarker=` ${marker} `;class TemplateResult{constructor(strings,values,type,processor){this.strings=strings;this.values=values;this.type=type;this.processor=processor}getHTML(){const l=this.strings.length-1;let html="";let isCommentBinding=false;for(let i=0;i<l;i++){const s=this.strings[i];const commentOpen=s.lastIndexOf("\x3c!--");isCommentBinding=(commentOpen>-1||isCommentBinding)&&s.indexOf("--\x3e",commentOpen+1)===-1;const attributeMatch=lastAttributeNameRegex.exec(s);if(attributeMatch===null){html+=s+(isCommentBinding?commentMarker:nodeMarker)}else{html+=s.substr(0,attributeMatch.index)+attributeMatch[1]+attributeMatch[2]+boundAttributeSuffix+attributeMatch[3]+marker}}html+=this.strings[l];return html}getTemplateElement(){const template=document.createElement("template");let value=this.getHTML();if(policy!==undefined){value=policy.createHTML(value)}template.innerHTML=value;return template}}const isPrimitive=value=>value===null||!(typeof value==="object"||typeof value==="function");const isIterable=value=>Array.isArray(value)||!!(value&&value[Symbol.iterator]);class AttributeCommitter{constructor(element,name,strings){this.dirty=true;this.element=element;this.name=name;this.strings=strings;this.parts=[];for(let i=0;i<strings.length-1;i++){this.parts[i]=this._createPart()}}_createPart(){return new AttributePart(this)}_getValue(){const strings=this.strings;const l=strings.length-1;const parts=this.parts;if(l===1&&strings[0]===""&&strings[1]===""){const v=parts[0].value;if(typeof v==="symbol"){return String(v)}if(typeof v==="string"||!isIterable(v)){return v}}let text="";for(let i=0;i<l;i++){text+=strings[i];const part=parts[i];if(part!==undefined){const v=part.value;if(isPrimitive(v)||!isIterable(v)){text+=typeof v==="string"?v:String(v)}else{for(const t of v){text+=typeof t==="string"?t:String(t)}}}}text+=strings[l];return text}commit(){if(this.dirty){this.dirty=false;this.element.setAttribute(this.name,this._getValue())}}}class AttributePart{constructor(committer){this.value=undefined;this.committer=committer}setValue(value){if(value!==noChange&&(!isPrimitive(value)||value!==this.value)){this.value=value;if(!isDirective(value)){this.committer.dirty=true}}}commit(){while(isDirective(this.value)){const directive=this.value;this.value=noChange;directive(this)}if(this.value===noChange){return}this.committer.commit()}}class NodePart{constructor(options){this.value=undefined;this.__pendingValue=undefined;this.options=options}appendInto(container){this.startNode=container.appendChild(createMarker());this.endNode=container.appendChild(createMarker())}insertAfterNode(ref){this.startNode=ref;this.endNode=ref.nextSibling}appendIntoPart(part){part.__insert(this.startNode=createMarker());part.__insert(this.endNode=createMarker())}insertAfterPart(ref){ref.__insert(this.startNode=createMarker());this.endNode=ref.endNode;ref.endNode=this.startNode}setValue(value){this.__pendingValue=value}commit(){if(this.startNode.parentNode===null){return}while(isDirective(this.__pendingValue)){const directive=this.__pendingValue;this.__pendingValue=noChange;directive(this)}const value=this.__pendingValue;if(value===noChange){return}if(isPrimitive(value)){if(value!==this.value){this.__commitText(value)}}else if(value instanceof TemplateResult){this.__commitTemplateResult(value)}else if(value instanceof Node){this.__commitNode(value)}else if(isIterable(value)){this.__commitIterable(value)}else if(value===nothing){this.value=nothing;this.clear()}else{this.__commitText(value)}}__insert(node){this.endNode.parentNode.insertBefore(node,this.endNode)}__commitNode(value){if(this.value===value){return}this.clear();this.__insert(value);this.value=value}__commitText(value){const node=this.startNode.nextSibling;value=value==null?"":value;const valueAsString=typeof value==="string"?value:String(value);if(node===this.endNode.previousSibling&&node.nodeType===3){node.data=valueAsString}else{this.__commitNode(document.createTextNode(valueAsString))}this.value=value}__commitTemplateResult(value){const template=this.options.templateFactory(value);if(this.value instanceof TemplateInstance&&this.value.template===template){this.value.update(value.values)}else{const instance=new TemplateInstance(template,value.processor,this.options);const fragment=instance._clone();instance.update(value.values);this.__commitNode(fragment);this.value=instance}}__commitIterable(value){if(!Array.isArray(this.value)){this.value=[];this.clear()}const itemParts=this.value;let partIndex=0;let itemPart;for(const item of value){itemPart=itemParts[partIndex];if(itemPart===undefined){itemPart=new NodePart(this.options);itemParts.push(itemPart);if(partIndex===0){itemPart.appendIntoPart(this)}else{itemPart.insertAfterPart(itemParts[partIndex-1])}}itemPart.setValue(item);itemPart.commit();partIndex++}if(partIndex<itemParts.length){itemParts.length=partIndex;this.clear(itemPart&&itemPart.endNode)}}clear(startNode=this.startNode){removeNodes(this.startNode.parentNode,startNode.nextSibling,this.endNode)}}class BooleanAttributePart{constructor(element,name,strings){this.value=undefined;this.__pendingValue=undefined;if(strings.length!==2||strings[0]!==""||strings[1]!==""){throw new Error("Boolean attributes can only contain a single expression")}this.element=element;this.name=name;this.strings=strings}setValue(value){this.__pendingValue=value}commit(){while(isDirective(this.__pendingValue)){const directive=this.__pendingValue;this.__pendingValue=noChange;directive(this)}if(this.__pendingValue===noChange){return}const value=!!this.__pendingValue;if(this.value!==value){if(value){this.element.setAttribute(this.name,"")}else{this.element.removeAttribute(this.name)}this.value=value}this.__pendingValue=noChange}}class PropertyCommitter extends AttributeCommitter{constructor(element,name,strings){super(element,name,strings);this.single=strings.length===2&&strings[0]===""&&strings[1]===""}_createPart(){return new PropertyPart(this)}_getValue(){if(this.single){return this.parts[0].value}return super._getValue()}commit(){if(this.dirty){this.dirty=false;this.element[this.name]=this._getValue()}}}class PropertyPart extends AttributePart{}let eventOptionsSupported=false;(()=>{try{const options={get capture(){eventOptionsSupported=true;return false}};window.addEventListener("test",options,options);window.removeEventListener("test",options,options)}catch(_e){}})();class EventPart{constructor(element,eventName,eventContext){this.value=undefined;this.__pendingValue=undefined;this.element=element;this.eventName=eventName;this.eventContext=eventContext;this.__boundHandleEvent=e=>this.handleEvent(e)}setValue(value){this.__pendingValue=value}commit(){while(isDirective(this.__pendingValue)){const directive=this.__pendingValue;this.__pendingValue=noChange;directive(this)}if(this.__pendingValue===noChange){return}const newListener=this.__pendingValue;const oldListener=this.value;const shouldRemoveListener=newListener==null||oldListener!=null&&(newListener.capture!==oldListener.capture||newListener.once!==oldListener.once||newListener.passive!==oldListener.passive);const shouldAddListener=newListener!=null&&(oldListener==null||shouldRemoveListener);if(shouldRemoveListener){this.element.removeEventListener(this.eventName,this.__boundHandleEvent,this.__options)}if(shouldAddListener){this.__options=getOptions(newListener);this.element.addEventListener(this.eventName,this.__boundHandleEvent,this.__options)}this.value=newListener;this.__pendingValue=noChange}handleEvent(event){if(typeof this.value==="function"){this.value.call(this.eventContext||this.element,event)}else{this.value.handleEvent(event)}}}const getOptions=o=>o&&(eventOptionsSupported?{capture:o.capture,passive:o.passive,once:o.once}:o.capture);function templateFactory(result){let templateCache=templateCaches.get(result.type);if(templateCache===undefined){templateCache={stringsArray:new WeakMap,keyString:new Map};templateCaches.set(result.type,templateCache)}let template=templateCache.stringsArray.get(result.strings);if(template!==undefined){return template}const key=result.strings.join(marker);template=templateCache.keyString.get(key);if(template===undefined){template=new Template(result,result.getTemplateElement());templateCache.keyString.set(key,template)}templateCache.stringsArray.set(result.strings,template);return template}const templateCaches=new Map;const parts=new WeakMap;const render$1=(result,container,options)=>{let part=parts.get(container);if(part===undefined){removeNodes(container,container.firstChild);parts.set(container,part=new NodePart(Object.assign({templateFactory:templateFactory},options)));part.appendInto(container)}part.setValue(result);part.commit()};class DefaultTemplateProcessor{handleAttributeExpressions(element,name,strings,options){const prefix=name[0];if(prefix==="."){const committer=new PropertyCommitter(element,name.slice(1),strings);return committer.parts}if(prefix==="@"){return[new EventPart(element,name.slice(1),options.eventContext)]}if(prefix==="?"){return[new BooleanAttributePart(element,name.slice(1),strings)]}const committer=new AttributeCommitter(element,name,strings);return committer.parts}handleTextExpression(options){return new NodePart(options)}}const defaultTemplateProcessor=new DefaultTemplateProcessor;if(typeof window!=="undefined"){(window["litHtmlVersions"]||(window["litHtmlVersions"]=[])).push("1.4.1")}const html=(strings,...values)=>new TemplateResult(strings,values,"html",defaultTemplateProcessor);const getTemplateCacheKey=(type,scopeName)=>`${type}--${scopeName}`;let compatibleShadyCSSVersion=true;if(typeof window.ShadyCSS==="undefined"){compatibleShadyCSSVersion=false}else if(typeof window.ShadyCSS.prepareTemplateDom==="undefined"){console.warn(`Incompatible ShadyCSS version detected. `+`Please update to at least @webcomponents/webcomponentsjs@2.0.2 and `+`@webcomponents/shadycss@1.3.1.`);compatibleShadyCSSVersion=false}const shadyTemplateFactory=scopeName=>result=>{const cacheKey=getTemplateCacheKey(result.type,scopeName);let templateCache=templateCaches.get(cacheKey);if(templateCache===undefined){templateCache={stringsArray:new WeakMap,keyString:new Map};templateCaches.set(cacheKey,templateCache)}let template=templateCache.stringsArray.get(result.strings);if(template!==undefined){return template}const key=result.strings.join(marker);template=templateCache.keyString.get(key);if(template===undefined){const element=result.getTemplateElement();if(compatibleShadyCSSVersion){window.ShadyCSS.prepareTemplateDom(element,scopeName)}template=new Template(result,element);templateCache.keyString.set(key,template)}templateCache.stringsArray.set(result.strings,template);return template};const TEMPLATE_TYPES=["html","svg"];const removeStylesFromLitTemplates=scopeName=>{TEMPLATE_TYPES.forEach((type=>{const templates=templateCaches.get(getTemplateCacheKey(type,scopeName));if(templates!==undefined){templates.keyString.forEach((template=>{const{element:{content:content}}=template;const styles=new Set;Array.from(content.querySelectorAll("style")).forEach((s=>{styles.add(s)}));removeNodesFromTemplate(template,styles)}))}}))};const shadyRenderSet=new Set;const prepareTemplateStyles=(scopeName,renderedDOM,template)=>{shadyRenderSet.add(scopeName);const templateElement=!!template?template.element:document.createElement("template");const styles=renderedDOM.querySelectorAll("style");const{length:length}=styles;if(length===0){window.ShadyCSS.prepareTemplateStyles(templateElement,scopeName);return}const condensedStyle=document.createElement("style");for(let i=0;i<length;i++){const style=styles[i];style.parentNode.removeChild(style);condensedStyle.textContent+=style.textContent}removeStylesFromLitTemplates(scopeName);const content=templateElement.content;if(!!template){insertNodeIntoTemplate(template,condensedStyle,content.firstChild)}else{content.insertBefore(condensedStyle,content.firstChild)}window.ShadyCSS.prepareTemplateStyles(templateElement,scopeName);const style=content.querySelector("style");if(window.ShadyCSS.nativeShadow&&style!==null){renderedDOM.insertBefore(style.cloneNode(true),renderedDOM.firstChild)}else if(!!template){content.insertBefore(condensedStyle,content.firstChild);const removes=new Set;removes.add(condensedStyle);removeNodesFromTemplate(template,removes)}};const render=(result,container,options)=>{if(!options||typeof options!=="object"||!options.scopeName){throw new Error("The `scopeName` option is required.")}const scopeName=options.scopeName;const hasRendered=parts.has(container);const needsScoping=compatibleShadyCSSVersion&&container.nodeType===11&&!!container.host;const firstScopeRender=needsScoping&&!shadyRenderSet.has(scopeName);const renderContainer=firstScopeRender?document.createDocumentFragment():container;render$1(result,renderContainer,Object.assign({templateFactory:shadyTemplateFactory(scopeName)},options));if(firstScopeRender){const part=parts.get(renderContainer);parts.delete(renderContainer);const template=part.value instanceof TemplateInstance?part.value.template:undefined;prepareTemplateStyles(scopeName,renderContainer,template);removeNodes(container,container.firstChild);container.appendChild(renderContainer);parts.set(container,part)}if(!hasRendered&&needsScoping){window.ShadyCSS.styleElement(container.host)}};var _a;window.JSCompiler_renameProperty=(prop,_obj)=>prop;const defaultConverter={toAttribute(value,type){switch(type){case Boolean:return value?"":null;case Object:case Array:return value==null?value:JSON.stringify(value)}return value},fromAttribute(value,type){switch(type){case Boolean:return value!==null;case Number:return value===null?null:Number(value);case Object:case Array:return JSON.parse(value)}return value}};const notEqual=(value,old)=>old!==value&&(old===old||value===value);const defaultPropertyDeclaration={attribute:true,type:String,converter:defaultConverter,reflect:false,hasChanged:notEqual};const STATE_HAS_UPDATED=1;const STATE_UPDATE_REQUESTED=1<<2;const STATE_IS_REFLECTING_TO_ATTRIBUTE=1<<3;const STATE_IS_REFLECTING_TO_PROPERTY=1<<4;const finalized="finalized";class UpdatingElement extends HTMLElement{constructor(){super();this.initialize()}static get observedAttributes(){this.finalize();const attributes=[];this._classProperties.forEach(((v,p)=>{const attr=this._attributeNameForProperty(p,v);if(attr!==undefined){this._attributeToPropertyMap.set(attr,p);attributes.push(attr)}}));return attributes}static _ensureClassProperties(){if(!this.hasOwnProperty(JSCompiler_renameProperty("_classProperties",this))){this._classProperties=new Map;const superProperties=Object.getPrototypeOf(this)._classProperties;if(superProperties!==undefined){superProperties.forEach(((v,k)=>this._classProperties.set(k,v)))}}}static createProperty(name,options=defaultPropertyDeclaration){this._ensureClassProperties();this._classProperties.set(name,options);if(options.noAccessor||this.prototype.hasOwnProperty(name)){return}const key=typeof name==="symbol"?Symbol():`__${name}`;const descriptor=this.getPropertyDescriptor(name,key,options);if(descriptor!==undefined){Object.defineProperty(this.prototype,name,descriptor)}}static getPropertyDescriptor(name,key,options){return{get(){return this[key]},set(value){const oldValue=this[name];this[key]=value;this.requestUpdateInternal(name,oldValue,options)},configurable:true,enumerable:true}}static getPropertyOptions(name){return this._classProperties&&this._classProperties.get(name)||defaultPropertyDeclaration}static finalize(){const superCtor=Object.getPrototypeOf(this);if(!superCtor.hasOwnProperty(finalized)){superCtor.finalize()}this[finalized]=true;this._ensureClassProperties();this._attributeToPropertyMap=new Map;if(this.hasOwnProperty(JSCompiler_renameProperty("properties",this))){const props=this.properties;const propKeys=[...Object.getOwnPropertyNames(props),...typeof Object.getOwnPropertySymbols==="function"?Object.getOwnPropertySymbols(props):[]];for(const p of propKeys){this.createProperty(p,props[p])}}}static _attributeNameForProperty(name,options){const attribute=options.attribute;return attribute===false?undefined:typeof attribute==="string"?attribute:typeof name==="string"?name.toLowerCase():undefined}static _valueHasChanged(value,old,hasChanged=notEqual){return hasChanged(value,old)}static _propertyValueFromAttribute(value,options){const type=options.type;const converter=options.converter||defaultConverter;const fromAttribute=typeof converter==="function"?converter:converter.fromAttribute;return fromAttribute?fromAttribute(value,type):value}static _propertyValueToAttribute(value,options){if(options.reflect===undefined){return}const type=options.type;const converter=options.converter;const toAttribute=converter&&converter.toAttribute||defaultConverter.toAttribute;return toAttribute(value,type)}initialize(){this._updateState=0;this._updatePromise=new Promise((res=>this._enableUpdatingResolver=res));this._changedProperties=new Map;this._saveInstanceProperties();this.requestUpdateInternal()}_saveInstanceProperties(){this.constructor._classProperties.forEach(((_v,p)=>{if(this.hasOwnProperty(p)){const value=this[p];delete this[p];if(!this._instanceProperties){this._instanceProperties=new Map}this._instanceProperties.set(p,value)}}))}_applyInstanceProperties(){this._instanceProperties.forEach(((v,p)=>this[p]=v));this._instanceProperties=undefined}connectedCallback(){this.enableUpdating()}enableUpdating(){if(this._enableUpdatingResolver!==undefined){this._enableUpdatingResolver();this._enableUpdatingResolver=undefined}}disconnectedCallback(){}attributeChangedCallback(name,old,value){if(old!==value){this._attributeToProperty(name,value)}}_propertyToAttribute(name,value,options=defaultPropertyDeclaration){const ctor=this.constructor;const attr=ctor._attributeNameForProperty(name,options);if(attr!==undefined){const attrValue=ctor._propertyValueToAttribute(value,options);if(attrValue===undefined){return}this._updateState=this._updateState|STATE_IS_REFLECTING_TO_ATTRIBUTE;if(attrValue==null){this.removeAttribute(attr)}else{this.setAttribute(attr,attrValue)}this._updateState=this._updateState&~STATE_IS_REFLECTING_TO_ATTRIBUTE}}_attributeToProperty(name,value){if(this._updateState&STATE_IS_REFLECTING_TO_ATTRIBUTE){return}const ctor=this.constructor;const propName=ctor._attributeToPropertyMap.get(name);if(propName!==undefined){const options=ctor.getPropertyOptions(propName);this._updateState=this._updateState|STATE_IS_REFLECTING_TO_PROPERTY;this[propName]=ctor._propertyValueFromAttribute(value,options);this._updateState=this._updateState&~STATE_IS_REFLECTING_TO_PROPERTY}}requestUpdateInternal(name,oldValue,options){let shouldRequestUpdate=true;if(name!==undefined){const ctor=this.constructor;options=options||ctor.getPropertyOptions(name);if(ctor._valueHasChanged(this[name],oldValue,options.hasChanged)){if(!this._changedProperties.has(name)){this._changedProperties.set(name,oldValue)}if(options.reflect===true&&!(this._updateState&STATE_IS_REFLECTING_TO_PROPERTY)){if(this._reflectingProperties===undefined){this._reflectingProperties=new Map}this._reflectingProperties.set(name,options)}}else{shouldRequestUpdate=false}}if(!this._hasRequestedUpdate&&shouldRequestUpdate){this._updatePromise=this._enqueueUpdate()}}requestUpdate(name,oldValue){this.requestUpdateInternal(name,oldValue);return this.updateComplete}async _enqueueUpdate(){this._updateState=this._updateState|STATE_UPDATE_REQUESTED;try{await this._updatePromise}catch(e){}const result=this.performUpdate();if(result!=null){await result}return!this._hasRequestedUpdate}get _hasRequestedUpdate(){return this._updateState&STATE_UPDATE_REQUESTED}get hasUpdated(){return this._updateState&STATE_HAS_UPDATED}performUpdate(){if(!this._hasRequestedUpdate){return}if(this._instanceProperties){this._applyInstanceProperties()}let shouldUpdate=false;const changedProperties=this._changedProperties;try{shouldUpdate=this.shouldUpdate(changedProperties);if(shouldUpdate){this.update(changedProperties)}else{this._markUpdated()}}catch(e){shouldUpdate=false;this._markUpdated();throw e}if(shouldUpdate){if(!(this._updateState&STATE_HAS_UPDATED)){this._updateState=this._updateState|STATE_HAS_UPDATED;this.firstUpdated(changedProperties)}this.updated(changedProperties)}}_markUpdated(){this._changedProperties=new Map;this._updateState=this._updateState&~STATE_UPDATE_REQUESTED}get updateComplete(){return this._getUpdateComplete()}_getUpdateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._updatePromise}shouldUpdate(_changedProperties){return true}update(_changedProperties){if(this._reflectingProperties!==undefined&&this._reflectingProperties.size>0){this._reflectingProperties.forEach(((v,k)=>this._propertyToAttribute(k,this[k],v)));this._reflectingProperties=undefined}this._markUpdated()}updated(_changedProperties){}firstUpdated(_changedProperties){}}_a=finalized;UpdatingElement[_a]=true;const supportsAdoptingStyleSheets=window.ShadowRoot&&(window.ShadyCSS===undefined||window.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype;const constructionToken=Symbol();class CSSResult{constructor(cssText,safeToken){if(safeToken!==constructionToken){throw new Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.")}this.cssText=cssText}get styleSheet(){if(this._styleSheet===undefined){if(supportsAdoptingStyleSheets){this._styleSheet=new CSSStyleSheet;this._styleSheet.replaceSync(this.cssText)}else{this._styleSheet=null}}return this._styleSheet}toString(){return this.cssText}}const unsafeCSS=value=>new CSSResult(String(value),constructionToken);const textFromCSSResult=value=>{if(value instanceof CSSResult){return value.cssText}else if(typeof value==="number"){return value}else{throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but\n            take care to ensure page security.`)}};const css=(strings,...values)=>{const cssText=values.reduce(((acc,v,idx)=>acc+textFromCSSResult(v)+strings[idx+1]),strings[0]);return new CSSResult(cssText,constructionToken)};(window["litElementVersions"]||(window["litElementVersions"]=[])).push("2.5.1");const renderNotImplemented={};class LitElement extends UpdatingElement{static getStyles(){return this.styles}static _getUniqueStyles(){if(this.hasOwnProperty(JSCompiler_renameProperty("_styles",this))){return}const userStyles=this.getStyles();if(Array.isArray(userStyles)){const addStyles=(styles,set)=>styles.reduceRight(((set,s)=>Array.isArray(s)?addStyles(s,set):(set.add(s),set)),set);const set=addStyles(userStyles,new Set);const styles=[];set.forEach((v=>styles.unshift(v)));this._styles=styles}else{this._styles=userStyles===undefined?[]:[userStyles]}this._styles=this._styles.map((s=>{if(s instanceof CSSStyleSheet&&!supportsAdoptingStyleSheets){const cssText=Array.prototype.slice.call(s.cssRules).reduce(((css,rule)=>css+rule.cssText),"");return unsafeCSS(cssText)}return s}))}initialize(){super.initialize();this.constructor._getUniqueStyles();this.renderRoot=this.createRenderRoot();if(window.ShadowRoot&&this.renderRoot instanceof window.ShadowRoot){this.adoptStyles()}}createRenderRoot(){return this.attachShadow(this.constructor.shadowRootOptions)}adoptStyles(){const styles=this.constructor._styles;if(styles.length===0){return}if(window.ShadyCSS!==undefined&&!window.ShadyCSS.nativeShadow){window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s=>s.cssText)),this.localName)}else if(supportsAdoptingStyleSheets){this.renderRoot.adoptedStyleSheets=styles.map((s=>s instanceof CSSStyleSheet?s:s.styleSheet))}else{this._needsShimAdoptedStyleSheets=true}}connectedCallback(){super.connectedCallback();if(this.hasUpdated&&window.ShadyCSS!==undefined){window.ShadyCSS.styleElement(this)}}update(changedProperties){const templateResult=this.render();super.update(changedProperties);if(templateResult!==renderNotImplemented){this.constructor.render(templateResult,this.renderRoot,{scopeName:this.localName,eventContext:this})}if(this._needsShimAdoptedStyleSheets){this._needsShimAdoptedStyleSheets=false;this.constructor._styles.forEach((s=>{const style=document.createElement("style");style.textContent=s.cssText;this.renderRoot.appendChild(style)}))}}render(){return renderNotImplemented}}LitElement["finalized"]=true;LitElement.render=render;LitElement.shadowRootOptions={mode:"open"};

// ======================================================================
// Основной класс карточки
// ======================================================================
class WledWsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.ws = null;
    this._heartbeatInterval = null;
    this._observer = null;
    this.initialized = false;
  }

  // Геттер для доступа к Home Assistant
  get hass() {
    return this._hass;
  }

  // Сеттер для hass
  set hass(hass) {
    this._hass = hass;
    // Если конфигурация не задана или содержит wildcard, подставляем первую найденную сущность с префиксом "sensor.wlvp_"
    if (!this.config.sensor || this.config.sensor.includes('*')) {
      const matchingSensor = Object.keys(hass.states).find(
        (entityId) => entityId.startsWith("sensor.wlvp_")
      );
      if (matchingSensor) {
        this.config.sensor = matchingSensor;
        if (this.config.info) {
          console.log("wled-ws-card: Wildcard sensor substituted:", matchingSensor);
        }
      }
    }
    if (this.config.sensor && hass.states[this.config.sensor]) {
      const sensorState = hass.states[this.config.sensor];
      if (sensorState.attributes && sensorState.attributes.entry_id) {
        if (this.config.entry_id !== sensorState.attributes.entry_id) {
          this.config.entry_id = sensorState.attributes.entry_id;
          if (this.config.info) {
            console.log("wled-ws-card: entry_id extracted from sensor:", this.config.entry_id);
          }
        }
      }
    }
  }

  setConfig(config) {
    if (!config) {
      throw new Error("wled-ws-card: Invalid configuration");
    }
    // Создаем копию конфигурации
    this.config = Object.assign({}, config);
    // Если переключатель info не задан, устанавливаем false
    if (this.config.info === undefined) {
      this.config.info = false;
    }
    if (this.config.info) {
      console.log("wled-ws-card: config =", this.config);
    }
    if (this.config.sensor) {
      if (this.hass && this.hass.states && this.hass.states[this.config.sensor]) {
        const sensorState = this.hass.states[this.config.sensor];
        if (sensorState.attributes && sensorState.attributes.entry_id) {
          this.config.entry_id = sensorState.attributes.entry_id;
          if (this.config.info) {
            console.log("wled-ws-card: entry_id extracted from sensor:", this.config.entry_id);
          }
        } else {
          if (this.config.info) {
            console.warn("wled-ws-card: entry_id not found in sensor attributes, using 'default'");
          }
          this.config.entry_id = "default";
        }
      } else {
        if (this.config.info) {
          console.warn("wled-ws-card: Sensor not found, using 'default'");
        }
        this.config.entry_id = "default";
      }
    } else if (!this.config.entry_id) {
      if (this.config.info) {
        console.warn("wled-ws-card: Neither sensor nor entry_id specified, using 'default'");
      }
      this.config.entry_id = "default";
    }
    // Если яркость не задана, используем 100%
    if (!this.config.brightness) {
      this.config.brightness = 100;
    }
    // Если угол не задан, устанавливаем по умолчанию 90°
    if (this.config.angle === undefined || this.config.angle === null) {
      this.config.angle = 90;
    }
    this.initialized = true;
  }

  connectedCallback() {
    if (!this.initialized) {
      this.setConfig({});
    }
    this.render();
    this._setupObserver();
  }

  disconnectedCallback() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  _setupObserver() {
    if (!("IntersectionObserver" in window)) {
      this._connectWebSocket();
      return;
    }
    this._observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (this.config.info) {
            console.log("wled-ws-card: Card is visible. Establishing WebSocket connection.");
          }
          this._connectWebSocket();
          this._observer.disconnect();
          this._observer = null;
        }
      });
    }, { threshold: 0.1 });
    this._observer.observe(this);
  }

  _connectWebSocket() {
    const entryId = encodeURIComponent(this.config.entry_id);
    // Здесь угол используется только на стороне клиента при формировании итогового CSS.
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/api/wled_ws/${entryId}`;
    if (this.config.info) {
      console.log("wled-ws-card: Connecting to WebSocket at", url);
    }
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      if (this.config.info) {
        console.log("wled-ws-card: WebSocket connected");
      }
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.ws.onclose = () => {
      if (this.config.info) {
        console.log("wled-ws-card: WebSocket disconnected");
      }
    };
    this.ws.onerror = (error) => {
      if (this.config.info) {
        console.error("wled-ws-card: WebSocket error", error);
      }
    };

    if (!this._heartbeatInterval) {
      this._heartbeatInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send("heartbeat");
          if (this.config.info) {
            console.log("wled-ws-card: Sent heartbeat");
          }
        }
      }, 30000);
    }
  }

  handleMessage(data) {
    if (this.config.debug) {
      console.log("wled-ws-card: Received data:", data);
    }
    const cardEl = this.shadowRoot.getElementById('card');
    if (cardEl) {
      // Здесь сервер возвращает только цвета, а угол формируется на стороне карточки.
      // Если в конфигурации задан angle (0..360), используем его, иначе по умолчанию 90.
      const angle = (this.config.angle !== undefined && this.config.angle !== null)
        ? this.config.angle : 90;
      cardEl.style.background = `linear-gradient(${angle}deg, ${data})`;
    }
  }

  render() {
    const brightness = this.config.brightness;
    this.shadowRoot.innerHTML = `
        <style>
          :host {
            --card-brightness: ${brightness}%;
          }
          ha-card {
            width: 100%;
            height: 100%;
            border-radius: var(--ha-card-border-radius, 8px);
            overflow: hidden;
          }
          .card-content {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            filter: brightness(var(--card-brightness, 100%));
          }
        </style>
        <ha-card>
          <div class="card-content" id="card"></div>
        </ha-card>
    `;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: 1,
      columns: 12,
    };
  }

  static getConfigElement() {
    return document.createElement("wled-ws-card-editor");
  }

  static getStubConfig() {
    return {
      sensor: "",
      debug: false,
      info: false,
      brightness: 100,
      angle: 90
    };
  }
}

customElements.define('wled-ws-card', WledWsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "wled-ws-card",
  name: "WLED Live View Card",
  preview: false,
  description: "Card for displaying live view from WLED via WebSocket.",
  documentationURL: "https://github.com/danishru/wled_liveviewproxy/?tab=readme-ov-file"
});

// ======================================================================
// Редактор конфигурации (LitElement вариант)
// ======================================================================

class WledWsCardEditor extends LitElement {
  static get properties() {
    return {
      _config: { type: Object },
      hass: { type: Object }
    };
  }
  
  constructor() {
    super();
    this._config = {};
  }
  
  setConfig(config) {
    this._config = config;
  }
  
  configChanged(newConfig) {
    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }
  
  static get styles() {
    return css`
      .editor {
        padding: 16px;
        font-family: var(--ha-font-family, sans-serif);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #333);
      }
      .selector-wrapper,
      .brightness-wrapper,
      .angle-wrapper {
        margin-bottom: 16px;
      }
      ha-formfield {
        display: block;
        width: 100%;
      }
      ha-selector {
        width: 100%;
      }
      .brightness-wrapper ha-textfield,
      .angle-wrapper ha-textfield {
        width: 100%;
      }
      .brightness-wrapper label,
      .angle-wrapper label {
        display: block;
        margin-bottom: 4px;
        font-weight: bold;
      }
      .switches-row {
        display: flex;
        gap: 16px;
      }
      .switches-row ha-formfield {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .switches-row ha-formfield > span[slot="label"] {
        order: 1;
        margin-right: 8px;
        font-size: 14px;
      }
      .switches-row ha-formfield > ha-switch {
        order: 2;
      }
    `;
  }
  
  render() {
    if (!this.hass) {
      return html`<div>Waiting for Home Assistant state...</div>`;
    }
    const sensors = Object.keys(this.hass.states).filter(
      entityId =>
        entityId.startsWith("sensor.wlvp_") &&
        this.hass.states[entityId].attributes &&
        this.hass.states[entityId].attributes.entry_id !== undefined
    );
    const selectorObj = {
      entity: {
        domain: "sensor",
        include_entities: sensors
      }
    };
    
    return html`
      <div class="editor">
        <!-- Селектор сущности без label -->
        <div class="selector-wrapper">
          <ha-formfield>
            <ha-selector
              .selector="${selectorObj}"
              .hass="${this.hass}"
              .value="${this._config.sensor || ''}"
              @value-changed="${this._sensorChanged}">
            </ha-selector>
            <span slot="label"></span>
          </ha-formfield>
        </div>
        <!-- Поле яркости карточки -->
        <div class="brightness-wrapper">
          <label>Card Brightness (%)</label>
          <ha-textfield
            .value="${this._config.brightness ? String(this._config.brightness) : '100'}"
            type="number"
            min="0"
            max="1000"
            step="1"
            @input="${this._brightnessChanged}">
          </ha-textfield>
        </div>
        <!-- Поле выбора угла градиента -->
        <div class="angle-wrapper">
          <label>Gradient Angle (degrees)</label>
          <ha-textfield
            .value="${(this._config.angle !== undefined && this._config.angle !== null) ? String(this._config.angle) : '90'}"
            type="number"
            min="0"
            max="360"
            step="1"
            @input="${this._angleChanged}">
          </ha-textfield>
        </div>
        <!-- Переключатели Info и Debug в одной строке -->
        <div class="switches-row">
          <ha-formfield>
            <span slot="label">Info Mode</span>
            <ha-switch
              ?checked="${this._config.info}"
              @change="${this._infoChanged}">
            </ha-switch>
          </ha-formfield>
          <ha-formfield>
            <span slot="label">Debug Mode</span>
            <ha-switch
              ?checked="${this._config.debug}"
              @change="${this._debugChanged}">
            </ha-switch>
          </ha-formfield>
        </div>
      </div>
    `;
  }
  
  _sensorChanged(e) {
    const sensor = e.detail.value;
    this._config = Object.assign({}, this._config, { sensor: sensor });
    this.configChanged(this._config);
  }
  
  _brightnessChanged(e) {
    const brightness = Number(e.target.value);
    this._config = Object.assign({}, this._config, { brightness: brightness });
    this.configChanged(this._config);
  }

  _angleChanged(e) {
    const angle = Number(e.target.value);
    this._config = Object.assign({}, this._config, { angle: angle });
    this.configChanged(this._config);
  }
  
  _infoChanged(e) {
    const info = e.target.checked;
    this._config = Object.assign({}, this._config, { info: info });
    this.configChanged(this._config);
  }
  
  _debugChanged(e) {
    const debug = e.target.checked;
    this._config = Object.assign({}, this._config, { debug: debug });
    this.configChanged(this._config);
  }
}

customElements.define('wled-ws-card-editor', WledWsCardEditor);