var _ = require('lodash'),
	jqtpl = require('jqtpl'),
	logger = require('lib/CaptainsLog'),
	tmpl = jqtpl.express;

var Jqtpl = function() { };

Jqtpl.prototype.attach = function (options) {
	var config = options.config;
	
	this.render = function (res, viewName, model, headers) {
		var html = '',
			layouthtml = null,
			layoutViewName = null,
	    	data = {
	        	model: model,
	        	utils: config.utils,
	        	config: config
	        },
	        // add express specific compatibility overrides - partial and layout
	    	expressExtensions = {
	    		partial: function(viewName, localdata) { 
	    			return renderHtml(viewName, localdata || data, expressExtensions, config); 
	    		},
	    		layout: function(viewName) { 
	    			layoutViewName = viewName; 
	    		}
	    	};
	    	
	    // render the main view.
	    try {
	    	html = renderHtml(viewName, data, expressExtensions, config);
	    } 
	    catch (e) {
	    	logger.debug(e.stack);
		    // write the error response
			res.writeHead(200, _.extend({ 'Content-Type': 'text/plain' }, headers) );
	        res.write(e.stack);
	        res.end();
	        return;
	    }

	    try {
	    	// if layout was found during initial render, then it was assigned to the layout property.  We need to process the layout now.
		    if (layoutViewName) {
		    	data.body = html;
		    	layouthtml = renderHtml(layoutViewName, data, expressExtensions, config);
		    }
	    }
	    catch (e) {
	    	layouthtml = "Error in layout template: " + e.stack + '<p>' + html + '</p>';
	        logger.debug(e.stack);
	    }

		// write the response
		res.writeHead(200, _.extend({ 'Content-Type': 'text/html' }, headers) );
        res.write(layouthtml || html);
        res.end();
	};

};

// `exports.init` gets called by broadway on `app.init`.
Jqtpl.prototype.init = function (done) {

  // This plugin doesn't require any initialization step.
  return done();

};

var renderHtml = function(viewName, data, expressExtensions, config){
    var html = '',
    	view = {
    		path: config.getView(viewName),
    		contents: config.getViewMarkup(viewName)
    	};

	if (!view.path) {
		var html = 'jqtpl plugin: Cannot find view - ' + viewName;
		logger.error(html);
	}
	else {

		// in debug, compile template every time.  WILL NOT SCALE IN PRODUCTION
		if (config.html.debug) {
			delete jqtpl.template[view.path];
			jqtpl.template(view.path, view.contents);
		}
		else { 
			config.templateCache[view.path] = ( config.templateCache[view.path] || jqtpl.template(view.path, view.contents) ); // precompile the template and cache it using filename  // tmpl.compile(markup, { filename: view, scope: jqtpl });
		}

		_.extend(data, { config: config, utils: config.utils });  // insure utils are always in the data
		_.extend(data, expressExtensions);  // insure express exts for jqtpl are there too.

		try {
			html = jqtpl.tmpl(view.path, data);  // render
		}
		catch (e) {
			e.message = 'ERROR in template: ' + viewName + ' (' + view.path + ').  ';
		}

	}

	return html;
};

module.exports = Jqtpl;
