// ==UserScript==
// @name          Jureeka
// @namespace     http://www.jureeka.org
// @description   Turns legal citations in webpages into hyperlinks that direct you to online legal source material.
// ==/UserScript==

//  $Id: jureeka.js 1644 2012-08-07 20:22:13Z wayne $

/*
  Warnings:

    * This triggers a memory leak bug in Firefox.
    * This triggers a dataloss bug in Firefox when editing long Wikipedia pages.

  Original author of AutoLink: Jesse Ruderman - http://www.squarefree.com/ - wrote the original script of Autolink.

  Original author of Jureeka: Michael Poulshock.

  License: MPL, GPL, LGPL.

*/

var enabled = true;
var maxSize = 2;
var scale = 1024*1024; //MB

/***********************************
 *      When and where to run      *
 ***********************************/

var moddingDOM = false;
window.addEventListener("load", init, false);

function init()
{
    //var pagembytes = document.body.length;
    //alert(pagemybtes);
    chrome.extension.sendRequest({localstorage: "state"}, function(response) {
        var cState = response.state;
        var pagembytes = document.body.innerHTML.length;
        var bound=1024 * 1024 * 2;
        if(cState=="Disable" && pagembytes < bound) {
            document.addEventListener("DOMNodeInserted", nodeInserted, false);
            setTimeout(go, 50, document.body);
        }
    });

    /*
    _maxSize = document.documentElement.getAttribute("maxSize");
    maxSize = parseFloat(_maxSize) * scale;
    var pagembytes = document.documentElement.innerHTML.length;
    */
}

// This makes it work at Gmail.
// 20% performance penalty on a plain text file with a link on almost every line.
// Tiny performance penalty on pages with few automatically added links.
function nodeInserted(e)
{
  // our own modifications should not trigger this.
  // (we don't want our regular expression objects getting confused)
  // (we want better control over when we recurse)

  //GM_log("Inserted: " + e.target);

  if (!moddingDOM && enabled)
    go(e.target);
}

/***********************************
 *          DOM traversal          *
 ***********************************/

/*
  This script uses manual DOM traversal, in an iterative way without a stack!

  Advantages of snapshot XPath:
    * Much less code
    * 20-40% faster
    * May be possible to get another speed boost by including the regexp in the XPath expression - http://www.developer.com/xml/article.php/10929_3344421_3
    * All the cool people are using it

  Advantages of manual DOM traversal:
    * Lets us stop+continue (snapshot xpath doesn't let us)
    * Lets us modify DOM in strange ways without worrying.
    * Easier to control which elements we recurse into.

*/

// Ignore all children of these elements.
const skippedElements = {
  a:        true, // keeps us from screwing with existing links. keeps us from recursing to death :)
  noscript: true, // noscript has uninterpreted, unshown text children; don't waste time+sanity there.
  head:     true,
  script:   true,
  style:    true,
  textarea: true,
  label:    true,
  select:   true,
  button:   true
}

const gmail = (location.host == "gmail.google.com");

function skipChildren(node)
{
  if (node.tagName)  // !
  {
    if (skippedElements[node.tagName.toLowerCase()]) {
      return true;
    }

    if (gmail) {
      if (node.className == "ac") // gmail autocomplete (fake dropdown)
        return true;
      if (node.className == "ilc sxs") // invite foo to gmail (fake link/button)
        return true;
    }
  }

  return false;
}

// Don't insert hyperlinks on certain legal research sites
function go(traversalRoot)
{
  var currentURL = location.host;
  
  if(enabled && currentURL.indexOf('lexis') == -1 && currentURL.indexOf('westlaw') == -1 && currentURL.indexOf('loislaw') == -1 && currentURL.indexOf('fastcase') == -1)
  {
	
    go2(traversalRoot);
  }
}


function go2(traversalRoot)
{
  var m;
  // Ensure we're not already in a forbidden element.
  for (m = traversalRoot; m != undefined; m = m.parentNode) {

    if (skipChildren(m)) {
      return;
    }
  }

  // work around bug, or in case previous user scripts did crazy stuff
  traversalRoot.normalize();

  function cont(n, didChildren)
  {
    var k = 0; // split work into chunks so Firefox doesn't freeze
    var q;

    while (n && k < 100)
    {
      ++k;
      // Do stuff at this node
      if (!didChildren && n.nodeType == 3) {
        if((q = runFiltersOnTextNode(n))) {
          n = q[0];
          // if there were changes, run filters again on the new text node that's here
          if (q[1])
            continue;
        }
      }

      // Traverse to the "next" node in depth-first order

      if (!n.firstChild)
        didChildren = true;

      if (didChildren && n == traversalRoot)
        break;
      else if (!didChildren && n.firstChild && !skipChildren(n)) {
        n = n.firstChild;
        // didChildren is already false and should stay false
      }
      else {
        if (n.nextSibling) {
          n = n.nextSibling;
          didChildren = false;
        }
        else {
          n = n.parentNode;
          didChildren = true;
        }
      }
    } // end while

    if (!n) {
      //GM_log("Odd. traversalRoot was " + traversalRoot);
    }
    else if (n == traversalRoot) {
      //GM_log("Done");
      //alert("AutoLink time: " + (new Date() - timeBefore))
    }
    else {
      // Continue after 10ms.
      //GM_log("will have to continue");
      setTimeout(cont, 10, n, didChildren);
    }

  } // end function cont

  cont(traversalRoot, false);
}


/***********************************
 *         Running filters         *
 ***********************************/

// runFiltersOnTextNode
// Return: node at which to continue traversal, or |null| to mean no changes were made.

function runFiltersOnTextNode(node)
{
  // Too many variables.  Good hint that I need to split this function up :P
  var source, j, regexp, match, lastLastIndex, k, filter, href, anyChanges; // things
  var used, unused, firstUnused, lastUnused, a, parent, nextSibling; // nodes

  source = node.data;
  anyChanges = false;

  // runFiltersOnTextNode has its own do-too-much-at-once avoider thingie.
  // assumption: if there is one text node with a lot of matches,
  // it's more important to finish quickly than be transparent.
  // (e.g. plain text file FULL of links)
  // assumption: 40 * 100 = 140.
  k=0;

  for (j = 0; filter = filters[j]; ++j) {
    regexp = filter.regexp;

    if (regexp.test(source)) {

      parent = node.parentNode;
      nextSibling = node.nextSibling;


      regexp.lastIndex = 0;
      firstUnused = null;

      // Optimization from the linkify that came with Greasemonkey(?):
      // instead of splitting a text node multiple times, take advantage
      // of global regexps and substring.

      for (match = null, lastLastIndex = 0; k < 40 && (match = regexp.exec(source)); ) {

	var citation = match[0];

	citation = citation.replace(/^\s+|\s+$/g,"");
	str = "" + source;

	var before = str.indexOf(citation) - 1;
        var after = before + citation.length + 1;

	var AN = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (before >= 0 && AN.indexOf(str.charAt(before)) != -1) continue;
	if (after < str.length && AN.indexOf(str.charAt(after)) != -1) continue;

        // this should happen first, so RegExp.foo is still good :)
        href = genLink(filter, match);
        if (href != null && href != location.href) {
          ++k;

          unused = document.createTextNode(source.substring(lastLastIndex, match.index));
          if (!anyChanges) {
            anyChanges = true;
            parent.removeChild(node);
            firstUnused = unused;
            moddingDOM = true;
          }
          parent.insertBefore(unused, nextSibling);

          used = document.createTextNode(match[0])

          a = document.createElement("a");
          a.href = href;
		  a.title = "Link to " + filter.name + " added by Cornell LII";
          a.className = "autolink autolink-" + filter.classNamePart;
          a.style.borderBottom = "1px solid green";

          a.appendChild(used);
          parent.insertBefore(a, nextSibling);

          lastLastIndex = regexp.lastIndex;
        }

      }

      if (anyChanges) {
        lastUnused = document.createTextNode(source.substring(lastLastIndex));
        parent.insertBefore(lastUnused, nextSibling);
        moddingDOM = false;
        return [firstUnused, true]
      }

      return [node, false];
    }
  }
  return null;
}

function genLink(filter, match)
{
  try {
    for (i = 1; i < match.length; i++) {
        match[i] = encodeURIComponent(match[i]);
    }
    return filter.href(match);
  }
  catch(er) {
    return "data:text/plain,Error running AutoLink function for filter: " + encodeURIComponent(filter.name) + "%0A%0A" + encodeURIComponent(er);
  }
}
