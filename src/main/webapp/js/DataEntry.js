/*
Copyright 2009 University of Toronto

Licensed under the Educational Community License (ECL), Version 2.0. 
ou may not use this file except in compliance with this License.

You may obtain a copy of the ECL 2.0 License at
https://source.collectionspace.org/collection-space/LICENSE.txt
*/

/*global jQuery, fluid_1_1*/

var cspace = cspace || {};

(function ($, fluid) {

    // This is a temporary function, in place only until the ID service is accessible
    // through the APP layer.
    var newID = function (model, idField) {
        var id = model[idField];
        if ((!id || (id === "")) && model.accessionNumber) {
            id = model.accessionNumber.split(" ")[0];
        }
        if ((!id || (id === "")) && model.objectTitle) {
            id = model.objectTitle.split(" ")[0];
        }
        if (!id || (id === "")) {
            id = new Date().getTime().toString();
        }
        return id;
    };
    
    // Ultimately, the UISpec will be loaded via JSONP (see CSPACE-300). Until then,
    // load it manually via ajax
    var fetchUISpec = function (that, callback) {
        jQuery.ajax({
            url: that.options.uiSpecUrl,
            type: "GET",
            dataType: "json",
            success: callback,
            error: function (xhr, textStatus, errorThrown) {
                that.showSpecErrorMessage(that.options.strings.specFetchError + textStatus + that.options.strings.errorRecoverySuggestion);
                that.locate("feedbackMessage").hide();
                that.events.onError.fire("fetch UISpec");
            }
        });
    };


    fetchAutoGeneratedNumber = function (that, callback) {
        jQuery.ajax({
            url: that.dataContext.urlFactory.urlForModelPath("*", {csid: "__auto"}),
            type: "GET",
            dataType: "json",
            success: callback,
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                that.refreshView();
            }
        });
    };

    var buildEmptyModelFromSpec = function (spec) {
        var model = {};
        for (var key in spec) {
            if (spec.hasOwnProperty(key)) {
                model[key] = "";
            }
        }
        return model;
    };
    
    var makeDCErrorHandler = function (that) {
        return function(operation/*["create", "delete", "fetch", "update"]*/, modelPath, message){
            var msgKey = operation + "FailedMessage";
            var msg = that.options.strings[msgKey] + message;
            that.locate("feedbackMessage").text(msg).show();
            that.events.onError.fire(operation);
        };
    };

    var setupDataContext = function (that) {
        return function(spec, textStatus){
            that.spec = spec.spec;

            // insert the resourceMapper options retrieved with the UISpec into the options structure
            that.options.dataContext.options = that.options.dataContext.options || {};
            that.options.dataContext.options.modelToResourceMap = spec.modelToResourceMap;
            that.options.dataContext.options.replacements = spec.replacements;

            that.dataContext = fluid.initSubcomponent(that, "dataContext", [that.model, fluid.COMPONENT_OPTIONS]);

            bindEventHandlers(that);
            
            fluid.model.copyModel(that.model, buildEmptyModelFromSpec(that.spec));
            var queryParams = {};
            if (that.options.csid) {
                queryParams[that.options.idField] = that.options.csid;
                that.dataContext.fetch("*", queryParams);
            }
            else if (that.options.autoGenNumField) {
                fetchAutoGeneratedNumber(that, function (data, textStatus) {
                        that.model[that.options.autoGenNumField] = data.id;
                        that.refreshView();
                    }
                );
            }
            else {
                that.refreshView();
            }
        };
    };
    
    var bindEventHandlers = function (that) {
        that.dataContext.events.modelChanged.addListener(function (newModel, oldModel, source) {
            that.events.modelChanged.fire(newModel, oldModel, source);
            that.refreshView();
            that.locate("feedbackMessage").hide();
        });

        that.dataContext.events.afterCreate.addListener(function (modelPath, data) {
            that.events.afterCreateObjectDataSuccess.fire(data, that.options.strings.createSuccessfulMessage);
            that.locate("feedbackMessage").text(that.options.strings.createSuccessfulMessage).show();
        });

        that.dataContext.events.afterUpdate.addListener(function (modelPath, data) {
            that.events.afterUpdateObjectDataSuccess.fire(data, that.options.strings.updateSuccessfulMessage);
            that.locate("feedbackMessage").text(that.options.strings.updateSuccessfulMessage).show();
        });

        that.dataContext.events.onError.addListener(makeDCErrorHandler(that));
    };
    
    var setupDataEntry = function (that) {
        fetchUISpec(that, setupDataContext(that));
    };

    /**
     * Object Entry component
     */
    cspace.dataEntry = function (container, options) {
        var that = fluid.initView("cspace.dataEntry", container, options);
        that.model = {};
        that.spec = {};

        that.refreshView = function () {
            cspace.renderer.renderPage(that);
        };
        
        that.updateModel = function (newModel, source) {
            that.events.modelChanged.fire(newModel, that.model, source);
            fluid.clear(that.model);
            fluid.model.copyModel(that.model, newModel);
            that.refreshView();
        };
        
        that.showSpecErrorMessage = function (msg) {
            that.locate("errorMessage", "body").text(msg);
            that.locate("errorDialog", "body").dialog({
                modal: true,
                dialogClass: "fl-widget"
            });
        };

        that.save = function () {
            that.events.onSave.fire(that.model);
            if (that.options.csid) {
                that.dataContext.update("*");
            } else {
                that.model[that.options.idField] = newID(that.model, that.options.idField);    // temporary, till server returns ID
                that.dataContext.create("*");
            }
            return false;
        };

        setupDataEntry(that);
        return that;
    };
    
    cspace.saveId = "save";
    
    fluid.defaults("cspace.dataEntry", {
        dataContext: {
            type: "cspace.resourceMapperDataContext"
        },
        events: {
            modelChanged: null,
			onSave: null,
            afterCreateObjectDataSuccess: null,  // params: data, textStatus
            afterUpdateObjectDataSuccess: null,  // params: data, textStatus
            onError: null,  // params: operation
            pageRendered: null
        },
        selectors: {
            errorDialog: ".csc-error-dialog",
            errorMessage: ".csc-error-message",
            save: ".csc-save",
            saveSecondary: ".csc-save-bottom",
            feedbackMessage: ".csc-saved-message"
        },
        strings: {
            specFetchError: "I'm sorry, an error has occurred fetching the UISpec: ",
            errorRecoverySuggestion: "Please try refreshing your browser",
            updateSuccessfulMessage: "Object Record successfully saved",
            createSuccessfulMessage: "New Object Record successfully created",
            updateFailedMessage: "Error saving Record: ",
            createFailedMessage: "Error creating Record: ",
            deleteFailedMessage: "Error deleting Record: ",
            fetchFailedMessage: "Error retriving Record: "
        },
        templates: {
            header: {
                url: "../html/header.html",
                id: "name-header"
            },
            body: {
                url: "../html/ObjectEntryTemplate.html",
                id: "csc-object-entry-template"
            },
            rightSidebar:  {
                url: "../html/right-sidebar.html",
                id: "csc-right-sidebar"
            },
            footer: {
                url: "../html/footer.html",
                id: "footer"
            }
        },
        csid: null,
        idField: "csid",

        autoGenNumField: null,
        
        // Ultimately, the UISpec will be loaded via JSONP (see CSPACE-300). Until then,
        // load it manually via ajax
        uiSpecUrl: "./schemas/collection-object/schema.json"

    });
})(jQuery, fluid_1_1);
