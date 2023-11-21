import { Octokit } from "https://esm.sh/@octokit/core"; 

const resultsHeader = document.querySelector("#resultsHeader"); 
let isLeftAscending = true;
let isRightAscending = true;
let useapi = true;
let league="Ancestor";
let standardLeague="Standard";
let loadLeague = true;
//full paths
//this could be a bit smaller and we could append the league name and type
//but some items are itemoverview and some are currencyoverview
//this is simpler
//league name will change every ~4 months and would have have to be updated anyway
const POENINJA_PATHS = {
    'beasts' : 'itemoverview?league=Ancestor&type=Beast',
    'breach' : 'currencyoverview?league=Ancestor&type=Fragment',
    'invitations' : 'itemoverview?league=Ancestor&type=Invitation',
    'lifeforce' : 'currencyoverview?league=Ancestor&type=Currency',
}
//relative paths to the json files in the repo
const TFT_PATHS = {
    'beasts' : 'lsc/bulk-beasts.json',
    'breach' : 'lsc/bulk-breach.json',
    'invitations' : 'lsc/bulk-invitation.json',
    'lifeforce' : 'lsc/bulk-lifeforce.json',
}


//assign navbar event listeners to each span 
document.querySelectorAll("#navBar span").forEach(span => span.onclick = navOnClick);

//asssign search field event listener
document.querySelector('#searchInput').addEventListener('input', filterResults);

//assign sort listeners to left and right headers
document.querySelector('#leftHeader').addEventListener('click', function() {
    sortAndMatchColumns('TFT Price', isLeftAscending);
    updateSortIndicator('left', isLeftAscending);
    isLeftAscending = !isLeftAscending;
});
document.querySelector('#rightHeader').addEventListener('click', function() {
    sortAndMatchColumns('POE Trade Price', isRightAscending);
    updateSortIndicator('right', isRightAscending);
    isRightAscending = !isRightAscending;
});
//load data from localStorage
document.addEventListener("DOMContentLoaded", loadDataOnPageLoad);

    
    


//changes the indicator in the header to show which column is being sorted
function updateSortIndicator(column, isAscending) {
    // Update the arrow for the current column
    let indicator = document.getElementById(column + 'SortIndicator');
    indicator.textContent = isAscending ? '↓' : '↑';
    indicator.style.display = 'inline';  // Make sure the current indicator is visible

    // Hide the arrows for other columns
    document.querySelectorAll('.sort-indicator').forEach(ind => {
        if (ind !== indicator) {
            ind.style.display = 'none'; // Hide other indicators
        }
    });
}

//sorts the columns based on the sort value and the order
function sortAndMatchColumns(sortValue, isAscending) {
    let primaryColumnID, secondaryColumnIDs;

    //supports sorting by price of either column
    switch (sortValue) {
        case 'TFT Price':
            primaryColumnID = '#leftData';
            secondaryColumnIDs = ['#middleData', '#rightData'];
            break;
        case 'POE Trade Price':
            primaryColumnID = '#rightData';
            secondaryColumnIDs = ['#leftData', '#middleData'];
            break;
    }

    // Sort the primary column with the specified order
    sortColumnByPrice(primaryColumnID, isAscending);

    // Get the sorted name order from the primary column
    let nameOrder = getNameOrder(primaryColumnID);

    // Reorder other columns to match the name order
    secondaryColumnIDs.forEach(columnID => {
        matchNameOrder(columnID, nameOrder);
    });
}
//sorts a single column by pulling data from the data-chaos-price attribute and sorting by ascending or descending
function sortColumnByPrice(columnID, isAscending) {
    let container = document.querySelector(columnID);
    let itemsArray = Array.from(container.getElementsByClassName('result'));

    itemsArray.sort((a, b) => {
        let aValue = parseFloat(a.getAttribute('data-chaos-price'));
        let bValue = parseFloat(b.getAttribute('data-chaos-price'));
        return isAscending ? aValue - bValue : bValue - aValue;
    });

    itemsArray.forEach(item => container.appendChild(item));
}
//gets the name order of a column after it was sorted
function getNameOrder(columnID) {
    let container = document.querySelector(columnID);
    let items = container.getElementsByClassName('result');
    return Array.from(items).map(item => item.getAttribute('data-item-name').toLowerCase());
}
//sorts the other columns to match the name order of the sorted column
function matchNameOrder(columnID, nameOrder) {
    let container = document.querySelector(columnID);
    let itemsArray = Array.from(container.getElementsByClassName('result'));

    let orderedItems = nameOrder.map(name => 
        itemsArray.find(item => item.getAttribute('data-item-name').toLowerCase() === name));

    orderedItems.forEach(item => {
        if (item) container.appendChild(item);
    });
}

//allows the user to filter the results on the screen by the name
function filterResults() {
    const nameSearchValue = document.getElementById('searchInput').value.toLowerCase();
    
    const results = document.querySelectorAll('.result');

    results.forEach(result => {
        const itemName = result.getAttribute('data-item-name').toLowerCase();

        let matchesName = itemName.includes(nameSearchValue);

        if (matchesName) {
            result.style.display = '';
        } else {
            result.style.display = 'none';
        }
    });
}
//load data from localStorage and display it on the screen
async function loadDataOnPageLoad() {
    const lastDataType = localStorage.getItem('lastDataType');
    if (lastDataType) {
        await loadDataBasedOnType(lastDataType);
    }
}
//loads the data based on the type of data
//uses api or local json files depending on useapi bool
async function loadDataBasedOnType(type) {
    const sortableHeaders = document.querySelectorAll('.sortable-header');
    
    // display the headers
    sortableHeaders.forEach(header => {
        header.style.display = 'block';
    });

    //display the spinner and clear other columns
    let middleDataDiv = document.querySelector('#middleData');
    middleDataDiv.innerHTML = `<div id="test" class="spinner"></div>`;
    middleDataDiv.style.width = '33.33%';

    let leftDataDiv = document.querySelector('#leftData');
    leftDataDiv.innerHTML = '';
    leftDataDiv.style.width = '33.33%';

    let rightDataDiv = document.querySelector('#rightData');
    rightDataDiv.innerHTML = '';
    rightDataDiv.style.width = '33.33%';
    let tftJson, POENinjaJson;

    const storageKey = `data-${type}`;
    const cachedData = sessionStorage.getItem(storageKey);
    if (cachedData) {
        ({ tftJson, POENinjaJson } = JSON.parse(cachedData));
        console.log("loaded cached data");
    }
    else {
        if (useapi) {
            let tftPath = TFT_PATHS[type];

            let poeNinjaPath = POENINJA_PATHS[type];
            let githubURL = await fetchDownloadURLFromGitHub(tftPath);

            const response  = await fetch(githubURL);
            tftJson = await response.json();
            POENinjaJson = await createPOENinjaQuery(poeNinjaPath); 
          //  console.log("loaded API data");
        } 
        else {

            let tftPath, poeNinjaPath;
            if (type == "beasts") {
                tftPath = "json/beasts.json";
                poeNinjaPath = "json/poeninja-beasts.json";
            }
            else if (type == "breach") {
                tftPath = "json/breach.json";
                poeNinjaPath = "json/poeninja-fragments.json";
            }
            else if (type == "invitations") {
                tftPath = "json/invitations.json";
                poeNinjaPath = "json/poeninja-invitations.json";
            }
            else if (type == "maps") {
                tftPath = "json/maps.json";
                poeNinjaPath = "json/poeninja-maps.json";
            }
            else if (type == "lifeforce") {
                tftPath = "json/lifeforce.json";
                poeNinjaPath = "json/poeninja-currency.json";
            }
            tftJson = await loadJsonFromFile(tftPath);
            POENinjaJson = await loadJsonFromFile(poeNinjaPath);
          //  console.log("loaded Local JSON data");
        
        }
        const dataToCache = { tftJson, POENinjaJson };
        sessionStorage.setItem(storageKey, JSON.stringify(dataToCache));
    }   
    try {
        filterThenCompareData(POENinjaJson, tftJson, type);
    } catch (error) {
        console.log(error);
    }
}
//fetch data from json file and return as a promise
async function loadJsonFromFile(path) {
    return fetch(path)
        .then((response) => response.json())
        .then((json) => json); 
}

//on click listener for the navbar
async function navOnClick() {
    

    resultsHeader.innerHTML = `Results for ${this.getAttribute("data-type")}`;

    let type = this.getAttribute("data-type");  //get the attribute name
    localStorage.setItem('lastDataType', type);  // Storing the data type in localStorage

    loadDataBasedOnType(type);  //load the data
    
}



//displays that data in the data parameter in the columns 1-3
function displayData(data, type, column) {
    let string = '';
    let columnID;
    //choose which column to display the data in
    switch (column) {
        case 1:
            columnID = "#leftData";
            break;
        case 2:
            columnID = "#middleData";
            break;
        case 3:
            columnID = "#rightData";
            break;
    }
    //get that column
    let resultsData = document.querySelector(columnID);
    //loop through the data and build the html string
    for (let x = 0; x < data.length; x++) {
        let entry = data[x];
        let evenOrOdd = x % 2 == 0 ? "even" : "odd";

        // Determine which properties to use based on the type
        let chaosPrice, divinePrice, itemName;
        

        //some data in POENinja data was stored in chaosValue and some in chaosEquivalent
        //so we check for both and use the one that is not null
        if (type === 'TFT') {
            chaosPrice = entry.chaos;
            divinePrice = entry.divine;
            itemName = entry.name;
        } else { // Assume POE Ninja
            chaosPrice = entry.chaosValue || entry.chaosEquivalent; // Using chaosValue or chaosEquivalent
            divinePrice = entry.divineValue;
            itemName = entry.name || entry.currencyTypeName; // Using name or currencyTypeName
        }

        // Build the HTML string
        string += `<div class='result ${evenOrOdd}' data-item-name='${itemName}' data-chaos-price='${chaosPrice}'><h3>${itemName}</h3>`;
        string += `<div class='price'><img src='images/chaosOrb.png' alt='chaos' class='currencyTooltip'>${chaosPrice}`;

        //hide the div price if its low or null - some data didnt have a divine price
        if (chaosPrice > 50 &&  divinePrice != null) {
            string += `<img src='images/divineOrb.png' alt='divine' class='currencyTooltip'>${divinePrice}</div></div>`;
        } else {
            string += `</div></div>`;
        }
    }
    resultsData.innerHTML = string;
    
}

//filters the data to make sure that only name matching data is kept
//poe ninja data had 10,000+ lines but we only want was is also in the tft data
function filterThenCompareData(poeData, tftData, dataType = '') {

    
    //some of the data in tft didn't have exact item names
    //so hardcode lifeforce names and change the ratio to 1:1 instead of 1:1000
    if (dataType === 'lifeforce') {
        tftData.data.forEach(item => {
            if (item.name.startsWith('Vivid')) {
                item.name = 'Vivid';
                item.chaos /= Number(item.ratio);
            }
            else if (item.name.startsWith('Primal')) {
                item.name = 'Primal';
                item.chaos /= Number(item.ratio);
            }
            else if (item.name.startsWith('Wild')) {
                item.name = 'Wild';
                item.chaos /= Number(item.ratio);
            }
            item.name += ' Crystallised Lifeforce';
        });
    }
    
    

    //filter data to make sure only matching names are kept
    let filteredPoeNinjaData = filterData(poeData.lines, tftData.data);
    let filteredTFTData = filterData(tftData.data, filteredPoeNinjaData);

    //get the correct name from the poe ninja data for the currency value 
    let compareCurrencyTypeName = filteredPoeNinjaData[0].chaosValue ? false : true;
    

    //sort tft data by name
    let sortedTFTData = sortByName(filteredTFTData);
    //then sort the 2nd array by the first array
    let sortedPoeNinjaData = sortSecondArrayByFirst(sortedTFTData, filteredPoeNinjaData, compareCurrencyTypeName);

    
    //call compare data to display the results
    compareData(sortedPoeNinjaData, sortedTFTData);
}
//Quicksort algorithm to sort the data by name attribute
function sortByName(arr, left = 0, right = arr.length - 1) {
    if (left < right) {
        let pivotIndex = partitionByName(arr, left, right); 
        sortByName(arr, left, pivotIndex - 1); 
        sortByName(arr, pivotIndex + 1, right); 
    }
    return arr;
}
//Quicksort helper method
function partitionByName(arr, left, right) {
    let pivot = arr[right]; 
    let i = left - 1;

    for (let j = left; j < right; j++) {
        if (arr[j].name.localeCompare(pivot.name) < 0) { // compare based on the 'name' field
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]]; 
        }
    }

    [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]]; 
    return i + 1;
}
//QuickSort algorithm to sort the data by chaos value
function quickSortByCost(arr, dataType, left = 0, right = arr.length - 1) {
    if (left < right) {
        let pivotIndex = partitionByCost(arr, left, right, dataType); 
        quickSortByCost(arr, dataType, left, pivotIndex - 1); 
        quickSortByCost(arr, dataType, pivotIndex + 1, right); 
    }
    return arr;
}
//QuickSort helper method
function partitionByCost(arr, left, right, dataType) {
    let pivot = arr[right]; 
    let i = left - 1;

    for (let j = left; j < right; j++) {
        let valueJ = dataType === 'TFT' ? arr[j].chaos : arr[j].chaosValue;
        let valuePivot = dataType === 'TFT' ? pivot.chaos : pivot.chaosValue;

        if (valueJ > valuePivot) { 
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]]; 
        }
    }

    [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]]; 
    return i + 1;
}
//Sorts and returns the second array by the first arry matching the name order
function sortSecondArrayByFirst(arr1, arr2, compareCurrencyTypeName = false) {
    let propertyName = compareCurrencyTypeName ? 'currencyTypeName' : 'name';

    let map = new Map(arr2.map(item => [item[propertyName], item]));

    let sortedArr2 = arr1.map(item => map.get(item.name));

    return sortedArr2;
}

//compare the data in the 2 arrays by their chaos value
//then build an html string to display the results
function compareData(poeData, tftData) {
    let string = "";

    for (let x = 0; x < poeData.length; x++) {
        let poeItem = poeData[x];
        let tftItem = tftData[x];

        

        let poeItemName = poeItem.name || poeItem.currencyTypeName; // Using name or currencyTypeName
        let poeItemChaosValue = poeItem.chaosValue || poeItem.chaosEquivalent; // Using chaosValue or chaosEquivalent

        

        let evenOrOdd = x % 2 === 0 ? "even" : "odd";
        let imgSrc;
        let percentDifference;

        let chaosDifference = Number(poeItemChaosValue) - Number(tftItem.chaos);

        percentDifference = Math.abs(chaosDifference / tftItem.chaos * 100).toFixed(2) + "%";
        
        string += `<div class='result ${evenOrOdd} column-2' data-item-name='${poeItemName}'>`;
        if (poeItemChaosValue > tftItem.chaos) {
            imgSrc = 'images/green_right_new.png';
        } else if (poeItemChaosValue < tftItem.chaos) {
            imgSrc = 'images/red_left_new.png';
        } else {
            imgSrc = 'images/shrug.png';
        }
        string += `<img src='${imgSrc}' alt='compare'>${percentDifference}</div>`;
        
    }
    
    //display the results in the middle column then call displayData to display the other 2 columns
    document.querySelector("#middleData").innerHTML = string;
    displayData(poeData, 'POE Ninja', 3);
    displayData(tftData, 'TFT', 1);
}

//filters the data from poe.ninja and returns an array of the filtered data
function filterData(array1, array2) {
    let filteredData = array1.filter(item1 => {
        return array2.some(item2 => {
            if (item1.name && item2.name){
                return item1.name === item2.name;
            }
            else if (item1.name) {
                return item1.name === item2.currencyTypeName;
            }
            else if (item2.name) {
                return item1.currencyTypeName === item2.name;
            }
            else {
                return item1.currencyTypeName === item2.currencyTypeName;
            }
        });
    });
    return filteredData;
}


//begins pulling data from POE Ninja API
//this is expecting a full poe ninja api url with the CORS proxy already appended:
//https://quiet-island-56330-899af1836277.herokuapp.com/https://poe.ninja/api/data/currencyoverview?league=Ancestor&type=Currency

async function createPOENinjaQuery(url) {
    let string = url;
    //load standard league instead
    if (!loadLeague) {
        const leagueIndex = string.indexOf('?league=');
        if (leagueIndex !== -1) {
            const afterLeague = string.indexOf('&', leagueIndex);
            const leaguePart = afterLeague !== -1 ? string.substring(leagueIndex, afterLeague) : string.substring(leagueIndex);
            const newLeaguePart = leaguePart.replace(league, standardLeague);
            string = string.replace(leaguePart, newLeaguePart);
        }
    }
    let response = await getPOENinjaData(string);
    return response;
}
//actually gets the poe ninja data with fetch()
async function getPOENinjaData(url) {
    try {
        //append the CORS proxy url to the poe ninja url
        const response = await fetch("https://quiet-island-56330-899af1836277.herokuapp.com/https://poe.ninja/api/data/" + url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

//loads data from GIThub at the JsonPath
//this is a relative path to from the repo to that file
//so its expecting something like: 'lsc/bulk-beasts.json' 
//for the bulk-beats.json in the lsc folder
async function fetchDownloadURLFromGitHub(jsonPath) {
    const octokit = new Octokit({});
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner: 'The-Forbidden-Trove',
            repo: 'tft-data-prices',
            path: jsonPath,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return response.data.download_url;
    } catch (error) {
        console.error("An error occurred while fetching data from GitHub:", error);
    }
}


