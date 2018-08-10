
function Handler(func) {
	this.func = func;
}
Handler.prototype.solve = function() { console.log("no implement of solve.", arguments); };
Handler.prototype.reject = function() { console.log("no implement of reject.", arguments); };
Handler.prototype.then = function(solve, reject) {
	this.func(solve || this.solve, reject || this.reject);
};
String.prototype.format = function(args) {
    var result = this;
    if (arguments.length > 0) {    
        if (arguments.length == 1 && typeof (args) == "object") {
            for (var key in args) {
                if(args[key]!=undefined){
                    var reg = new RegExp("({)" + key + "(})", "g");
                    result = result.replace(reg, args[key]);
                }
            }
        }
        else {
            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] != undefined) {
                    //var reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题
　　　　　　　　　　　　var reg = new RegExp("({)" + i + "(})", "g");
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
    }
    return result;
};

function sqlite(dbname) {
	this.db = openDatabase(dbname, '3.0', dbname + ' db', 1024*1024);
}
sqlite.prototype.transaction = function(func) {
	this.db.transaction(func);
};
sqlite.prototype.exec = function(sql) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		this_.db.transaction(function(tx) {
			tx.executeSql(sql, [], function(tx, res) {
				solve(res);
			}, function(tx, err) {
				reject(err);
			});
		});
	});
};
sqlite.prototype.selectOne = function(table, key, where) {
	var whereStr = "", this_ = this;
	// console.log(where);
	if(!!where) {
		for(var k in where) {
			whereStr += " and {0} = '{1}'".format(k, where[k]);
		}
		if(whereStr.length > 0) {
			whereStr = whereStr.substr(4);
			whereStr = "where " + whereStr;
		}
	}
	var sql = "select {0} from {1} {2} order by {3} desc limit 1".format( key, table, whereStr, key );
	// console.log(sql);
	// console.log(key, table, whereStr, key);
	return new Handler(function(solve, reject) {
		this_.exec(sql).then(function(res) {
			if(res.rows.length) {
				var row = res.rows[0];
				for(var k in row) {
					return solve(row[k]);
				}
			}
			return solve(null);
		}, reject);
	});
};
sqlite.prototype.createTable = function(table, columns) {
	var this_ = this,
		colStr = "";
	return new Handler(function(solve, reject) {
		for(var name in columns) {
			colStr += ",{0} {1}".format(name, columns[name]);
		}
		if(colStr.length > 0) {
			var sql = "create table if not exists {0}({1})".format( table, colStr.substr(1) );
			this_.exec(sql).then(solve, reject);
		}
		else {
			reject();
		}
	});
};
sqlite.prototype.dropTable = function(table) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		if(!!table && table.length > 0) {
			var sql = "drop table if exists {0}".format(table);
			console.log(sql);
			this_.exec(sql).then(solve, reject);
		}
		else {
			reject();
		}
	});
};
sqlite.prototype.insert = function(table, datas) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		if(!!datas) {
			var cols = "", vals = "";
			for(var k in datas) {
				cols += "," + k;
				vals += ",'{0}'".format(datas[k]);
			}
			var sql = "insert into {0}({1}) values({2})".format(table, cols.substr(1), vals.substr(1));
			this_.exec(sql).then(function(res) {
				// SQLResultSet {rows: SQLResultSetRowList, insertId: 1, rowsAffected: 1}
				// console.log("insert", res);
				solve(res.rowsAffected);
			}, reject);
		}
		else {
			reject();
		}
	});
};
sqlite.prototype.update = function(table, datas, key) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		if(!!datas) {
			var cols = "", condition = "";
			for(var k in datas) {
				if(k == key) {
					condition = " where {0} = '{1}'".format(key, datas[k]);
				}
				cols += ",{0} = '{1}'".format(k, datas[k]);
			}
			var sql = "update {0} set {1} {2}".format(table, cols.substr(1), condition);
			console.log(sql);
			this_.exec(sql).then(function(res) {
				// console.log("update", res);
				solve(res.rowsAffected);
			}, reject);
		}
		else {
			reject();
		}
	});
};
sqlite.prototype.replaceInto = function(table, data, key) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		var queryData = {};
		queryData[key] = data[key];
		this_.selectOne(table, key, queryData).then(function(res) {
			if(!!res) {
				this_.update(table, data).then(solve, reject);
			}
			else {
				this_.insert(table, data).then(solve, reject);
			}
		}, reject);
	});
};
// 版本管理 

sqlite.prototype.getVersion = function() {
	var this_ = this;
	return new Handler(function(solve, reject) {
		this_.selectOne("_dbversion", "v", { "id" : 1 }).then(solve, reject);
	});
};

sqlite.prototype.setVersion = function(version) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		this_.createTable("_dbversion", {"id":"integer","v":"integer"}).then(function() {
			this_.replaceInto("_dbversion", {"id":1,"v":version}, "id").then(function(rowsAffected) {
				solve(rowsAffected);
			}, function(err) {
				console.log("replaceInfo failed", err);
				reject(err);
			});
		},function(err) {
			console.log("setVersion create table failed.", err);
			reject(err);
		});
	});
};

sqlite.prototype.initsql = function(currentVersion, sqlhandler) {
	var this_ = this;
	return new Handler(function(solve, reject) {
		function updateDB() {
			console.log("start update database");
			sqlhandler.then(function(data) {
				var lines = data.split("\n");
				this_.transaction(function(tx){
					for (var i = 0; i < lines.length; i++) {
						if(!!lines[i] && lines[i].length > 0) {
							var line = lines[i];
							tx.executeSql(line, [], null, this_.reject );
						}
					}
					this_.setVersion(currentVersion).then(solve, reject);
				});
			}, reject);
		}
		this_.getVersion().then(function(version) {
			console.log("suc", version, currentVersion);
			if(version != currentVersion) {
				updateDB();
			}
			else {
				solve();
			}
		}, function(err) {
			console.log("fail", err);
			updateDB();
		});
	});
};
