/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
(function () {
    'use strict';

    function convert(new_pounds) {
        var l = Math.floor(new_pounds);
        var d = (new_pounds - l) * 240;
        var s = Math.floor(d / 12);
        d = Math.round(d - (s * 12));

        var parts = [];
        if (l) {
            parts.push('£' + l);
        }
        if (s) {
            parts.push(s + 's');
        }
        if (d || (!l && !s)) {
            parts.push(d + 'd');
        }

        return parts.join('.');
    }

    function processNode(node) {
        if (!node.parentElement) { // just in case?
            return;
        }
        if (node.parentElement.tagName === 'STYLE' || node.parentElement.tagName === 'SCRIPT') {
            return;
        }
        if (node.nodeType !== node.TEXT_NODE) {
            return;
        }
        var text = node.nodeValue;
        var replacedText = text.replace(
            /£\s*(\d+\.\d+)(.?)/g,
            function (full, price, end) {
                if (end === 's' || end === 'd') {
                    return full;
                }
                price = parseFloat(price);
                if (isNaN(price)) {
                    return full;
                }
                return convert(price) + (end ? end : '');
            }
        ).replace(
            /(\d+)p\b/g,
            function (full, price) {
                price = parseFloat(price);
                if (isNaN(price)) {
                    return full;
                }
                return convert(price / 100);
            }
        );
        if (text != replacedText) {
            //console.log('Replacing "' + text + '" with "' + replacedText + '"');
            node.parentElement.replaceChild(document.createTextNode(replacedText), node);
        } else {
            if (/^\s*£\s*$/.test(text) && node.parentElement && node.parentElement.tagName === 'SPAN') {
                // Dastardly Tesco doing <span>£</span><span> </span><span>XX.XX</span>
                var element = node.parentElement;
                while (element = element.nextSibling) {
                    if (element.nodeType === element.TEXT_NODE
                        && /^\s*$/.test(element.nodeValue)) {
                        continue;
                    }
                    if (element.tagName === 'SPAN'
                        && element.childNodes.length === 1
                        && element.childNodes[0].nodeType === element.TEXT_NODE) {
                        var text = element.textContent;
                        if (/^\s*$/.test(text)) {
                            continue;
                        }
                        var replacedText = text.replace(
                            /^\s*(\d+\.\d+)\s*$/,
                            function (full, price) {
                                price = parseFloat(price);
                                if (isNaN(price)) {
                                    return full;
                                }
                                return convert(price);
                            }
                        );
                        if (text != replacedText) {
                            //console.log('Replacing adjacent "' + text + '" with "' + replacedText + '" in sibling node');
                            element.textContent = replacedText;
                            node.parentElement.removeChild(node);
                            break;
                        }
                    }
                    break;
                }
                // Amazon
                element = node.parentElement;
                var pounds, dot, fraction;
                if (element && (pounds = element.nextSibling)
                    && pounds.tagName === 'SPAN'
                    && (pounds.childNodes.length === 1 || pounds.childNodes.length === 2)
                    && pounds.childNodes[0].nodeType === element.TEXT_NODE
                    && /^\s*\d+\s*$/.test(pounds.childNodes[0].nodeValue)
                    && (pounds.childNodes.length === 1 ||
                        ((dot = pounds.childNodes[1]) && dot.tagName === 'SPAN'
                        && dot.childNodes.length == 1
                        && dot.childNodes[0].nodeType === element.TEXT_NODE
                        && /^\s*\.\s*$/.test(dot.textContent)))
                    && (fraction = pounds.nextSibling)
                    && fraction.tagName === 'SPAN'
                    && fraction.childNodes.length === 1
                    && fraction.childNodes[0].nodeType === element.TEXT_NODE) {
                    var price = parseFloat(fraction.textContent);
                    if (!isNaN(price)) {
                        fraction.textContent = convert(price / 100);
                        //console.log('Replaced Amazon-style price fraction "' + price + '" with "' + fraction.textContent + '"');
                    }
                }
                        
            }
        }
    }

    function processElementTree(element) {
        var elements = element.getElementsByTagName('*');

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];

            for (var j = 0; j < element.childNodes.length; j++) {
                var node = element.childNodes[j];

                processNode(node);
            }
        }
    }

    processElementTree(document.body);

    if (MutationObserver) {
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.type === 'characterData') {
                    processNode(mutation.target);
                } else if (mutation.type === 'childList'
                    && mutation.addedNodes) {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        var node = mutation.addedNodes[j];
                        processNode(node);
                        if (node.nodeType === node.ELEMENT_NODE) {
                            observer.observe(node, {childList: true, characterData: true, subtree: true});
                            processElementTree(node);
                        }
                    }
                }
            }
        });
        observer.observe(document.body, {childList: true, characterData: true, subtree: true});
    }
}());
