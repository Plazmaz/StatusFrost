//Grab settings object
var settings = new Store("settings");
var analyticsEnabled = settings.get("cb_enableAnalytics");
if(analyticsEnabled == undefined) {
    settings.set("cb_enableAnalytics", true)
    analyticsEnabled = true;
}
//No data is sent unless analyitcs are enabled.
(function(i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function() {
        (i[r].q = i[r].q || []).push(arguments)
    }, i[r].l = 1 * new Date();
    a = s.createElement(o),
        m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m)
})(window, document, 'script', 'js/analytics.js', 'ga');
ga('create', 'UA-67106116-5', 'auto');

//Check for updates
setInterval(update, 30000)

function update() {
    //Check Google Analytics:
    var originallyEnabled = analyticsEnabled;
    analyticsEnabled = settings.get("cb_enableAnalytics"); //Enable google analytics if analytics are permitted
    if(!originallyEnabled && analyticsEnabled) {
        ga('send', 'pageview', chrome.runtime.getManifest().version + "/optin");
    } else if(analyticsEnabled) {
        ga('send', 'pageview', chrome.runtime.getManifest().version);
    }

    //Grab updated category list:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            WEBSITE_CATEGORIES = JSON.parse(xhr.responseText)
        }
    };
    xhr.open("GET", 'https://raw.githubusercontent.com/StatusFrost/WebsiteCategories/master/website_categories.json', true);
    xhr.send()
}


//Initialization
update();

//Gather keypress velocity readings at x * 1000ms interval.
var VELOCITY_INTERVAL = 3;
var keyPressesWithinInterval = 0;
var intervalStart = -1;
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.type) {
            switch(request.type) {
                case "keypress":
                    incrementStatistic('cpm');
                    break;
                case "mouse_move_delta":
                    incrementValue('mouseDistanceMoved', Math.sqrt((request.dX) + (request.dY)));
                case "pageLoad":
                    incrementStatistic('pageviews');
                    if(request.sslUsed) {
                        incrementStatistic('sslviews');
                    } else {
                        incrementStatistic('nonsslviews');
                    }
                    if(request.domain) {
                        var categories = getDomainCategories(request.domain);
                        categories.forEach(function(category) {
                            incrementStatistic('category-' + category);
                        })
                    }
                    break;
                case "click":
                    incrementStatistic('totalClicks');
                    break;
            }
        }
        sendResponse();
    });

function getDomainCategories(domain) {
    var domainCategories = [];
    for(var i = 0; i < Object.keys(WEBSITE_CATEGORIES).length; i++) {
        var category = Object.keys(WEBSITE_CATEGORIES)[i];
        WEBSITE_CATEGORIES[category].forEach(function(pattern) {
            var dotCount = (domain.match(/\./g) || []).length;
            if(dotCount <= 1 && pattern.startsWith("*.")) {
                pattern = "*" + pattern.substring(2);
            }
            if((pattern.startsWith("*") && domain.endsWith(pattern.substring(1))) || pattern === domain) {
                domainCategories.push(category);
            }
        });
    }
    return domainCategories;
}

function StatTracker(name, velocityEnabled) {
    this.name = name;
    this.timer = null;
    this.velocityEnabled = velocityEnabled;
    this.valueWithinInterval = 0;
    this.minCount = 5 * (VELOCITY_INTERVAL / 3);
    this.minValue = 50;
}

var statTrackers = {
    cpm: new StatTracker('cpm', true),
    pageviews: new StatTracker('pageviews'),
    sslviews: new StatTracker('sslviews')
};

function incrementStatistic(statisticName) {
    if(!statTrackers[statisticName]) {
        statTrackers[statisticName] = new StatTracker(statisticName);
    }
    var tracker = statTrackers[statisticName];
    tracker.valueWithinInterval++;

    if(analyticsEnabled) {
        ga('send', 'event', 'Analytics Track', tracker.name);
    }

    if(!tracker.timer && tracker.velocityEnabled) {
        tracker.timer = setInterval(function() {
            var time = new Date().getTime();
            var statValue = tracker.valueWithinInterval;
            var avgOverTime = statValue * (60 / VELOCITY_INTERVAL)
            if(statValue <= tracker.minCount || avgOverTime < tracker.minValue) {
                tracker.valueWithinInterval = 0;
                return;
            }
            tracker.valueWithinInterval = 0;
            addValue(tracker.name, time, avgOverTime)
        }, VELOCITY_INTERVAL * 1000);
    } else if(!tracker.velocityEnabled) {
        incrementValue(tracker.name, 1)
    }
    statTrackers[statisticName] = tracker; //Just in case...
}


function incrementValue(storageKey, amount) {
    chrome.storage.sync.get(storageKey, function(result) {
        if(!result || !result[storageKey]) {
            result = 0;
        } else {
            result = result[storageKey];
        }
        result += amount;
        var setter = {};
        setter[storageKey] = result;
        chrome.storage.sync.set(setter, function() {});
    })

}

function addValue(storageKey, time, value) {
    chrome.storage.sync.get(storageKey, function(result) {
        if(!result) {
            result = {};
        } else {
            result = result[storageKey];
        }
        if(!result) {
            result = {};
        }
        result[time] = value;
        var setter = {};
        setter[storageKey] = result;
        chrome.storage.sync.set(setter, function() {});
    })

}
