//$Id: background.html 1146 2011-12-12 15:01:02Z wayne $

chrome.extension.onRequest.addListener (
function(request, sender, sendResponse) {
    
    if (request.localstorage == "state") {
        var cState = window.localStorage.jureeka_state;
        if ( typeof cState === "undefined" ) window.localStorage.setItem('jureeka_state', "Disable");
        sendResponse({state: window.localStorage.jureeka_state});
    }
    else{
        sendResponse({}); // snub them.
    }
});
