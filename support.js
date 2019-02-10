function CSVToArray( strData, strDelimiter ){
    // Check to see if the delimiter is defined. If not,
    // then default to comma.
    strDelimiter = (strDelimiter || ";");

    // Create a regular expression to parse the CSV values.
    var objPattern = new RegExp(
        (
            // Delimiters.
            "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

            // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

            // Standard fields.
            "([^\"\\" + strDelimiter + "\\r\\n]*))"
        ),
        "gi"
        );


    // Create an array to hold our data. Give the array
    // a default empty first row.
    var arrData = [];
    var headers = [];
    var headersFound = false;
    var headerIndex = 0;

    // Create an array to hold our individual pattern
    // matching groups.
    var arrMatches = null;


    // Keep looping over the regular expression matches
    // until we can no longer find a match.
    while (arrMatches = objPattern.exec( strData )){

        // Get the delimiter that was found.
        var strMatchedDelimiter = arrMatches[ 1 ];

        // Check to see if the given delimiter has a length
        // (is not the start of string) and if it matches
        // field delimiter. If id does not, then we know
        // that this delimiter is a row delimiter.
        if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter){

            // Since we have reached a new row of data,
            // add an empty row to our data array.
            arrData.push( {} );
            headersFound = true;
            headerIndex = 0;
        }

        var strMatchedValue;

        // Now that we have our delimiter out of the way,
        // let's check to see which kind of value we
        // captured (quoted or unquoted).
        if (arrMatches[ 2 ]){

            // We found a quoted value. When we capture
            // this value, unescape any double quotes.
            strMatchedValue = arrMatches[ 2 ].replace(new RegExp( "\"\"", "g" ),"\"");

        } else {

            // We found a non-quoted value.
            strMatchedValue = arrMatches[ 3 ];

        }


        // Now that we have our value string, let's add
        // it to the data array.
        if (!headersFound) {
          headers.push(strMatchedValue);
        } else {
          arrData[arrData.length -1][headers[headerIndex]] = strMatchedValue;
          headerIndex ++;
        }
    }

    // Return the parsed data.
    return( arrData );
}

function xportjson(json, fileName) {
	var fields = Object.keys(json[0])
	var replacer = function (key, value) { return value === null ? '' : value }
	var csv = json.map(function (row) {
		return fields.map(function (fieldName) {
			return JSON.stringify(row[fieldName], replacer)
		}).join(';')
	})
	csv.unshift(fields.join(';')) // add header column


	//var result=encodeURIComponent(csv.join('\r\n'));
	var result = csv.join('\r\n');

	var fileToSave = new Blob([result], { type: 'text/csv;charset=utf-8;' });
	saveAs(fileToSave, fileName);

}
