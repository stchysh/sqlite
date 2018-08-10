# sqlite
sqlite for js


var db = new sqlite("webdb");

var currentVersion = 2;
db.initsql(currentVersion, new Handler(function(solve, reject) {
	$.get("ky.sql", function(data) {
		if(!!data && data.length > 0) solve(data);
		else reject();
	});
})).then(function() {
	console.log("initsql success.");
}, function() {
	console.log("initsql failed.");
});

当获取不到版本号或获取到的版本号不等于数据库现存的版本号时，会就走传说的Handler去获取到要处理的sql语句，并执行。
