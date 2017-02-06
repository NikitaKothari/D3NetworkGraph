(function () {
    function DataFetcher(urlFactory, delay) {
        var self = this;

        self.repeat = false;
        self.delay = delay;
        self.timer = null;
        self.requestObj = null;

        function getNext() {
            self.requestObj = $.ajax({
                    url: urlFactory()
                }).done(function(response) {
                    $(self).trigger("stateFetchingSuccess", {
                        result: response
                    });
                }).fail(function(jqXHR, textStatus, errorThrown) {
                    $(self).trigger("stateFetchingFailure", {
                        error: textStatus
                    });
                }).always(function() {
                    if (self.repeat && _.isNumber(self.delay)) {
                        self.timer = setTimeout(getNext, self.delay);
                    }
                });
        }

        self.start = function(shouldRepeat) {
            self.repeat = shouldRepeat;
            getNext();
        };

        self.stop = function() {
            self.repeat = false;
            clearTimeout(self.timer);
        };

        self.repeatOnce = function() {
            getNext();
        };

        self.setDelay = function(newDelay) {
            this.delay = newDelay;
        };
    }

    function addNewEntry($container, contentHTML) {
        var $innerSpan = $("<p/>").text(contentHTML),
            $newEntry = $("<li/>").append($innerSpan);

        $container.append($newEntry);
    }
	
	var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
	radius = 7;
	
	var color = d3.scaleOrdinal(d3.schemeCategory20);


	var simulation = d3.forceSimulation().alphaDecay(0.01)
		.force("link", d3.forceLink().id(function(d) { return d.id; })
									 .distance(function(d) {return d.value * 32;})
									 .strength(0.1))
		.force("collide",d3.forceCollide( function(d){return d.value + 8 }).iterations(200) )
		.force("charge", d3.forceManyBody().strength(10))
		.force("center", d3.forceCenter(width / 2, height / 4))
		.force("y", d3.forceY())
        .force("x", d3.forceX());
		
	var tooltip =d3.select("body").append("div")	
				.attr("class", "tooltip")				
				.style("opacity", 0);

		

    var $trafficStatusList = $("#mockTrafficStat"),
        df2 = new DataFetcher(function() {
            return "/traffic_status";
        });

    $(df2).on({
        "stateFetchingSuccess": function(event, data) {
			var graph = {
				"nodes": [],
				"links": []
			};
			var totalTraffic = 0, averageTraffic = 0;
			data.result.data.forEach(function(dataEntry) {
				var obj = {"id" : dataEntry.srcObj, "group" : dataEntry.srcType};
                if(!graph.nodes.filter(function(e) { return e.id == dataEntry.srcObj; }).length > 0)
					graph.nodes.push(obj);
				graph.links.push({"source" : dataEntry.srcObj, "target" : dataEntry.destObj, "value" : dataEntry.packets * 32/dataEntry.traffic, "packet" : dataEntry.packets, "traffic" : dataEntry.traffic});
				totalTraffic += dataEntry.traffic;
            });	
			averageTraffic = totalTraffic / graph.links.length;
			var link = svg.append("g")
				.attr("class", "links")
				.selectAll("line")
				.data(graph.links)
				.enter().append("line")
				.attr("id", function(d) { return d.source + "-" + d.target + "-" + d.packet + "-" + d.traffic; })
				.on("mouseover", mouseoverLine)
				.on("mouseout", mouseoutLine)
				.attr("stroke-width", 2)
				.attr("class", function(d) { 
					if(d.traffic > averageTraffic * 1.5) return "redClass"; 
					else if(d.traffic > averageTraffic) return "yellowClass"; 
					else return "greenClass";
				});

			var node = svg.append("g")
				.attr("class", "nodes")
				.selectAll("circle")
				.data(graph.nodes)
				.enter().append("circle")
				.on("mouseover", mouseoverCircle)
				.on("mouseout", mouseoutCircle)
				.attr("id", function(d) { return d.id })
				.attr("r", radius)
				.attr("fill", function(d) { return color(d.group); })
				.call(d3.drag()
				.on("start", dragstarted)
				.on("drag", dragged)
				.on("end", dragended));

			node.append("title")
				.text(function(d) { return d.id; });

			simulation.nodes(graph.nodes)
				.on("tick", ticked);

			simulation.force("link")
				.links(graph.links);

			function ticked() {
				 node.attr("cx", function(d) { return d.x = Math.max(radius, Math.min(width - radius, d.x)); })
				.attr("cy", function(d) { return d.y = Math.max(radius, Math.min(height - radius, d.y)); });
				
				link.attr("x1", function(d) { return d.source.x; })
					.attr("y1", function(d) { return d.source.y; })
					.attr("x2", function(d) { return d.target.x; })
					.attr("y2", function(d) { return d.target.y; });
			
			}
  
			function mouseoverCircle(d, i) {
				d3.select(node._groups[0][i]).attr("r",10);
			}
  
			function mouseoutCircle(d, i) {
				d3.select(node._groups[0][i]).attr("r",radius);
			}
  
			function mouseoverLine(d, i) {
				var metaData = link._groups[0][i].id.split("-");
				var contentHTML = "";
				if(metaData[3] > averageTraffic * 1.5)
					contentHTML = "<b>High Traffic</b></br>"
				if(metaData[3] > averageTraffic)
					contentHTML = "<b>Medium Traffic</b></br>"
				else
					contentHTML = "<b>Normal Traffic</b></br>"
				
				contentHTML += "<b>Source: </b>" + metaData[0] + "</br>" +
								"<b>Target: </b>" + metaData[1] + "</br>" + 
								"<b>Packets: </b>" + metaData[2] + "</br>" +
								"<b>Traffic: </b>" + metaData[3];
				tooltip.transition()
            		.duration(300)
            		.style("opacity", .8);
            	tooltip.html(contentHTML)
            		.style("left", d3.event.pageY + 200 + "px")     
					.style("top", d3.event.pageY + "px")
					.style("text-align", "justify")
					.style("text-justify", "inter-word")
					.style("height", 80 + "px") 
					.style("width", 100 + "px");				
				d3.select(link._groups[0][i]).attr("stroke-width",4);
			}
  
			function mouseoutLine(d, i) {	
				tooltip.transition()		
                .duration(500)		
                .style("opacity", 0);	
				d3.select(link._groups[0][i]).attr("stroke-width",2);
			}
  
			var legendRectSize = 18;                                  
			var legendSpacing = 4;     

			var legends = [], i = 3;
			legends[0] = "red";
			legends[1] = "yellow";
			legends[2] = "green";

			for(var n in graph.nodes){
				if(graph.nodes[n].group && legends.indexOf(graph.nodes[n].group) == -1){
					legends[i] = graph.nodes[n].group;
					i++;
				}
			}

			var legend = svg.selectAll('.legend')                    
				  .data(legends)                                  
				  .enter()                                               
				  .append('g')                                           
				  .attr('class', 'legend')                               
				  .attr('transform', function(d, i) { 	  
					var height = legendRectSize + legendSpacing;         
					var offset =  height * color.domain().length / 2; 
					var horz = 2 * legendRectSize;
						if(i <= 2)
							horz = width - 200;
					var vert = (i + 1) * height;    
						if(i > 2)
							vert = (i - 2) * height
					return 'translate(' + horz + ',' + vert + ')';       
				  });                                                    
				legend.append('rect')                                    
					.attr('width', legendRectSize)                         
					.attr('height', legendRectSize)                        
					.style('fill', function(d){if(d == "red") return "red";
											   if(d == "yellow") return "yellow";
											   if(d == "green") return "green";
											   else return color(d)})                                 
					.style('stroke', function(d){if(d == "red") return "red";
											   if(d == "yellow") return "yellow";
											   if(d == "green") return "green";
											   else return color(d)});                               
					legend.append('text').attr('x', legendRectSize + legendSpacing)             
					.attr('y', legendRectSize - legendSpacing)             
					.text(function(d) { if(d == "red") return "Red line for heavy traffic";
									  else if(d == "yellow") return "Yellow line for medium traffic";
									  else if(d == "green") return "Green is for normal traffic";
									  else return d; });
									  
        },
        "stateFetchingFailure": function(event, data) {
            addNewEntry($trafficStatusList, JSON.stringify(data.error));
            addNewEntry($trafficStatusList, "Hit a snag. Retry after 1 sec...");
            setTimeout(function() {
                $trafficStatusList.html("");
                df2.repeatOnce();
            }, 1000);
        }
    });
	
	function dragstarted(d) {
	  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
	  d.fx = d.x;
	  d.fy = d.y;
	}

	function dragged(d) {
	  d.fx = d3.event.x;
	  d.fy = d3.event.y;
	}

	function dragended(d) {
	  /*if (!d3.event.active) simulation.alphaTarget(0);
	  d.fx = null;
	  d.fy = null;*/
	}
	
	function searchNode() {
		//find the node
		var selectedVal = document.getElementById('search').value;
		var node = svg.selectAll(".node");
		if (selectedVal == "none") {
			node.style("stroke", "white").style("stroke-width", "1");
		} else {
			var selected = node.filter(function (d, i) {
				return d.name != selectedVal;
			});
			selected.style("opacity", "0");
			var link = svg.selectAll(".link")
			link.style("opacity", "0");
			d3.selectAll(".node, .link").transition()
				.duration(5000)
				.style("opacity", 1);
		}
	}
	
	d3.select("button").on("click", reset);
	
	function reset() {
		svg.selectAll("g").remove();
		df2.start();
	}
	df2.start();
    
})();