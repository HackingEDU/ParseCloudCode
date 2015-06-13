function getApplicants(flimit, foffset) {
  // Retrieves json object of all templates retrieved from server
  //    @limit:  how many templates to retrieve
  //    @offset: item number to start retrieving from
  // Returns a jqXHR object
  var retval = undefined;

  return $.ajax(
    {
      url: "/action/",
      method: "GET",
      data: {
        limit:  flimit,
        offset: foffset
      }
    }
  );
}







function getTemplates(flimit, foffset) {
  // Retrieves json object of all templates retrieved from server
  //    @limit:  how many templates to retrieve
  //    @offset: item number to start retrieving from
  // Returns a jqXHR object
  var retval = undefined;

  return $.ajax(
    {
      url: "/action/getTemplates",
      method: "GET",
      data: {
        limit:  flimit,
        offset: foffset
      }
    }
  );
}

function templateMenu(jmenu, templates) {
  // Populates div#template_menu and return list of jQuery objects
  //  @jmenu: jQuery object of <ul> to populate
  //  @templates: array of template objects
  var promise = $.Deferred();
  var retval = [];

  try {
    if(jmenu === undefined || jmenu === undefined) {
      throw "Parameters undefined.";
    }

    // For each element in templates object, append to jmenu and add to retval
    $.each(templates, function(i, value) {
      var child = $("<li class=\"template_menu_li\">" + value.subject + "</li>");
      child.appendTo(jmenu);
      retval.push(child);
    });

    promise.resolve(retval);
    return promise;
  } catch(err) {
    promise.reject([err]);
    return promise;
  }
}

function templatePreview(jpreview, json) {
  // Populates jpreview
  //  @jmenu: jQuery object of <div> to populate
  //  @json: json object of currently selected template

  // TODO: render editor controls
  jpreview.html(json.bodyHTML);
}
