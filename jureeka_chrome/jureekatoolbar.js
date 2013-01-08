////////////////////////////////////////////////////////////////////////////////
// The Jureeka_Search() function will perform a Google search for us. The two
// parameters that get passed in are the event that triggered this function
// call, and the type of search to perform.
////////////////////////////////////////////////////////////////////////////////
function Jureeka_Search()
{
    // Get a handle to our search terms box (the <menulist> element)
    var searchTermsBox = document.getElementById("Jureeka-SearchTerms");
    
    // Get the value in the search terms box, trimming whitespace as necessary
    // See the Jureeka_TrimString() function farther down in this file for details
    // on how it works.
    var searchTerms = Jureeka_TrimString(searchTermsBox.value);

    if(searchTerms.length > 0) // Is the search terms box empty?
    {
        searchTerms = Jureeka_ConvertTermsToURI(searchTerms);
        // URL = "http://www.jureeka.net/Jureeka/FindByCite.aspx?cite=" + searchTerms;
        URL = "http://www.law.cornell.edu/jureeka/FindByCite.php?cite=" + searchTerms;
        Jureeka_LoadURL(URL);
        return true;
    }
    //else
    chrome.tabs.executeScript({code: 'alert("Please enter a citation in the search box.");'});
    return false;
}

////////////////////////////////////////////////////////////////////////////////
// The Jureeka_TrimString() function will trim all leading and trailing whitespace
// from the incoming string, and convert all runs of more than one whitespace
// character into a single space. The altered string gets returned.
////////////////////////////////////////////////////////////////////////////////
function Jureeka_TrimString(string)
{
    // If the incoming string is invalid, or nothing was passed in, return empty
    if (!string)
        return "";

    string = string.replace(/^\s+/, ''); // Remove leading whitespace
    string = string.replace(/\s+$/, ''); // Remove trailing whitespace

    // Replace all whitespace runs with a single space
    string = string.replace(/\s+/g, ' ');

    return string; // Return the altered value
}

////////////////////////////////////////////////////////////////////////////////
// The Jureeka_ConvertTermsToURI() function converts an incoming string of search
// terms to a safe value for passing into a URL.
////////////////////////////////////////////////////////////////////////////////
function Jureeka_ConvertTermsToURI(terms)
{
    // Create an array to hold each search term
    var termArray = new Array();

    // Split up the search term string based on the space character
    termArray = terms.split(" ");

    // Create a variable to hold our resulting URI-safe value
    var result = "";

    // Loop through the search terms
    for(var i=0; i<termArray.length; i++)
    {
        // All search terms (after the first one) are to be separated with a '+'
        if(i > 0)
            result += "+";

        // Encode each search term, using the built-in Firefox function
        // encodeURIComponent().
        result += encodeURIComponent(termArray[i]);
    }

    return result; // Return the result
}

////////////////////////////////////////////////////////////////////////////////
// The Jureeka_LoadURL() function loads the specified URL in the browser.
////////////////////////////////////////////////////////////////////////////////
function Jureeka_LoadURL(url)
{
    // Set the browser window's location to the incoming URL
    //window._content.document.location = url; // Firefox
    chrome.tabs.create({"url":url}); // Google Chrome
}

function Jureeka_ToggleState() {
    //put state in prefs.js or chrome equiv
    var x = document.getElementById("jureeka_enable");
    if (x.value == "Disable"){
        window.localStorage.setItem('jureeka_state', "Enable");
    }
    else{
        window.localStorage.setItem('jureeka_state', "Disable");
    }
    x.value = window.localStorage.jureeka_state;

    chrome.tabs.getSelected(null, function(tab) {
        chrome.tabs.update(tab.id, {url:tab.url});
    });
}

document.addEventListener('DOMContentLoaded', function () {
    var cState = window.localStorage.jureeka_state;
    if (typeof cState === "undefined"){
        window.localStorage.setItem('jureeka_state', "Disable");
        cState = window.localStorage.jureeka_state;
    }
    var input = document.getElementById('jureeka_enable');

    input.value = cState;
    input.addEventListener('click', Jureeka_ToggleState);
    
    document.getElementById('jureeka_cite_search').addEventListener('submit', Jureeka_Search);
});

