// Initializing data table reference...
//  $("#data_table").DataTable(
//    {
//      "dom": 'T<"clear">lfrtip',
//      "paging": false,
//      "scrollY": 400,
//      "tableTools": {
//        "sSwfPath": "/swf/copy_csv_xls_pdf.swf"
//      }
//    }

function getEmails(send_tools, column) {
  // Retrieve list of email addresses from a dataTable instance
  //    @send_tools: instance of dataTable
  //    @column: number of column to grab email address from
  // Create array of email addresses
  var retval    = [];
  var tr_emails = send_tools.fnGetSelectedData();

  for(var i = 0; i < tr_emails.length; i++) {
    retval.push(tr_emails[i][column]); // TODO: replace index with email address
  }

  return retval;
}

function sendEmail(send_form) {
  // Sends an email to a list of email addresses
  //    @send_form: jQuery instance of form to post
  //    Returns promise for jQuery ajax function
  // TODO: Check if template ID is selected condition
  var promise = $.Deferred();


  // TODO: prompt before sending
  return $.ajax({
    url: "/action/sendEmail",
    method: "POST",
    data: send_form.serialize()
  });
}



$(document).ready(function() {
  var templates  = undefined;
  var applicants = undefined;
  var emails     = [];

  // jQuery elements
  var template_menu  = $("#template_menu");
  var send_table  = $("#send_table");
  var send_tools  = undefined;
  var send_form   = $("#send_form");

  // Set up form handler
  var send_form_submit   = $("#send_form_submit");
  var send_form_template = $("#send_form_template");
  var send_form_emails   = $("#send_form_emails");

  var page_limit = 10; // How many items to display
  var page_curr  = 0;  // Current page
  getSubClass("Templates", page_limit, page_curr).then(
    function success(data, status) {
      templates = data;
      return templateMenu(template_menu, templates);
    },
    function error(jqXHR, status, err) {
      console.log("%s: %s", status, err);
    }
  ).then( //templateMenu() -> array of jQuery objects
    function success(retval) {
      // Bind click handlers to each object
      $.each(retval, function(i, value) {
        value.bind("click",
          function click(ev) {
            // Change value in send_form...
            cssSelectTemplate(value, send_form);

            // Update send_form with this template id
            send_form_template.attr("value", value.templateId);
          }
        );
      });
    },
    function error(err) {
      console.log(err);
    }
  );


  // Populate applicant table
  var applicants = undefined;
  getSubClass("Users").then(
    function success(data, status) {
      applicants = data;
      return applicantTable(send_table, applicants);
    },
    function error(jqXHR, status, err) {
      console.log("%s: %s", status, err);
    }
  ).then( // applicantTable() -> array of jQuery objects
    function success(retval) {
      // Create DataTable extension
      send_table.DataTable(
        {
          "dom": 'T<"clear">lfrtip',
          "tableTools": {
            "sSwfPath": "/swf/copy_csv_xls_pdf.swf",
            "sRowSelect": "os",
            "aButtons": [
              "select_all",
              "select_none",
              {
                "sAction":     "text",
                "sExtends":    "text",
                "sButtonText": "Send Emails",
                "fnClick": function click(node_button) { // disregard arguments... not important
                  if(send_form_template.attr("value") === "" ||
                     send_form_template.attr("value") === undefined) {
                    alert("Template not selected!");
                    var promise = $.Deferred();
                    promise.reject("Template not selected!");
                    return promise;
                  }

                  console.log(node_button);
                  // Retrieve emails from table
                  var emails = getEmails(send_tools, 2);

                  // Add emails to send_form (comma separated)
                  send_form_emails.attr("value", emails.join(","));
                  return sendEmail(send_form);
                }
              }
            ]
          }
        }
      );

      send_tools = TableTools.fnGetInstance("send_table");
    },
    function error(err) {
      console.log(err);
    }
  );
});
