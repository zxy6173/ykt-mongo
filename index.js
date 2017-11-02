'use strict';
const path = require("path");
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const DBRef = require('mongodb').DBRef;
const config = require(path.resolve("package.json"));
const url = config.db.url+"/"+config.db.dbname;

const arySort = function(ary){
    ary.sort(function(a,b){
        if(a._id < b._id){
            return -1;
        }else if(a._id > b._id){
            return 1;
        }else{
            return 0;
        }

    });
}
const dbCtrl = function(col, ctrl) {
    return function() {
        //将arguments转换为数组
        var arg = [].slice.apply(arguments);

        MongoClient.connect(url, function(err, db) {
            if (err) {
                console.log("数据库连接出错：" + err);
            } else {
                var c = db.collection(col);
                var func = arg[arg.length - 1];
                if (typeof(func) == "function") {
                    arg[arg.length - 1] = function(err, result) {
                        if (err) {
                            console.log("数据操作失败：" + err);
                        }
                        func(result);
                        //关闭数据库连接
                        db.close();
                    }
                }

                c[ctrl].apply(c, arg);
            }
        });
    }
}
const dbQueryCtrl = function(col, ctrl) {
    return function() {
        console.log(url);
        var arg = [].slice.apply(arguments);
        MongoClient.connect(url, function(err, db) {
            if (err) {
                console.log("数据库连接出错：" + err);
            } else {
                var c = db.collection(col);
                var func = arg.pop();
                var result = c[ctrl].apply(c, arg);
                if (typeof(func) == "function") {
                    if (err) {
                        console.log("数据操作失败：" + err);
                    }
                    result.toArray(function(err, data) {
                        func(data);
                        db.close();
                    });

                }


            }
        });
    }
}
const dbQueryPageCtrl = function(col, ctrl) {
    return function() {
        var arg = [].slice.apply(arguments);

        MongoClient.connect(url, function(err, db) {
            if (err) {
                console.log("数据库连接出错：" + err);
            } else {
                var c = db.collection(col);
                //获取当前页码和每页显示数
                var curpage = arg.shift();
                var eachpage = arg.shift();
                //如果页码不存在，则默认为第1页
                if(!curpage || isNaN(parseInt(curpage))){
                    curpage = 1;
                }
                //如果每页显示数不存在则默认为每页显示5条数据
                if(!eachpage || isNaN(parseInt(eachpage))){
                    eachpage = 5;
                }
                var func = arg.pop();

                if (typeof(func) == "function") {
                    c.count(arg[0],function(err, cnt) {
                        if (err) {
                            console.log("分页查询获取数据失败：" + err);
                        } else {
                            var result = c[ctrl].apply(c, arg);
                            result.limit(eachpage);
                            result.skip((curpage - 1) * eachpage);
                            result.toArray(function(err, data) {
                                var page = {
                                    curpage:curpage,
                                    eachpage:eachpage,
                                    maxpage:Math.ceil(cnt/eachpage),
                                    rows:data,
                                    total:cnt
                                }
                                func(page);
                                db.close();
                            });
                        }
                    });

                }

            }
        });
    }
}
const dbRefQuery = function(data,col,func){

        MongoClient.connect(url, function(err, db) {
            if (err) {
                console.log("数据库连接出错：" + err);
            } else {
                var newAry = [];
                if(data && data.length > 0 ){
                    data.forEach(function(ele){
                        if(ele[col] && ele[col]._bsontype == 'DBRef'){
                            db.collection(col).find({_id:ObjectID(ele[col].oid)}).toArray(function(err,result){
                                    if(result && result.length > 0){
                                        ele[col] = result[0];
                                    }else{
                                        ele[col] = {};
                                    }

                                    newAry.push(ele);

                                    if(newAry.length == data.length){

                                        arySort(newAry);
                                        func(newAry);
                                        db.close();
                                    }
                            })

                        }else{
                            newAry.push(ele);
                            if(newAry.length == data.length){

                                arySort(newAry);

                                func(newAry);
                                db.close();
                            }
                        }

                    })
                }else{
                    func(data);
                    db.close();
                }


            }
        });

}
exports.collection = function(col) {

    return {
        insert: dbCtrl(col, "insert"),
        update: dbCtrl(col, "update"),
        remove: dbCtrl(col, "remove"),
        find: dbQueryCtrl(col, "find"),
        findByPage: dbQueryPageCtrl(col, "find")

    }
}
exports.ObjectID = ObjectID;
exports.findJoin = dbRefQuery;
