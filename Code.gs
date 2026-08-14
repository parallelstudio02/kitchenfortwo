// Paste this into script.google.com (Extensions > Apps Script from inside your Google Sheet).
// Your Sheet needs one tab named exactly: Recipes
// Row 1 (headers) exactly: id | name | cuisine | recipeText | ingredients | notes | lastCooked
// "ingredients" is stored as one cell, items separated by semicolons, e.g. Chicken; Rice; Ginger

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Recipes');
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var recipes = data
    .filter(function(row) { return row[headers.indexOf('name')] !== ''; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      obj.ingredients = obj.ingredients
        ? String(obj.ingredients).split(';').map(function(s) { return s.trim(); }).filter(Boolean)
        : [];
      return obj;
    });
  return ContentService.createTextOutput(JSON.stringify(recipes)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Recipes');
  var body = JSON.parse(e.postData.contents);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = headers.indexOf('name');

  if (body.action === 'delete') {
    for (var d = 1; d < data.length; d++) {
      if (String(data[d][nameCol]).trim().toLowerCase() === String(body.name).trim().toLowerCase()) {
        sheet.deleteRow(d + 1); // sheet rows are 1-based, row 1 is the header
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'deleted' })).setMimeType(ContentService.MimeType.JSON);
  }

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nameCol]).trim().toLowerCase() === String(body.name).trim().toLowerCase()) {
      rowIndex = i + 1; // sheet rows are 1-based, and row 1 is the header
      break;
    }
  }

  var rowValues = headers.map(function(h) {
    if (h === 'ingredients') return (body.ingredients || []).join('; ');
    return body[h] !== undefined ? body[h] : '';
  });

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}
