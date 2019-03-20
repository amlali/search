var mongoose = require('mongoose');
var bcrypt   = require('bcryptjs');
var jwt      = require('jsonwebtoken');
var Config   = require('../config');
var Roles     = require('../static_arch/roles.js');
var timeFactory = require('../modules/time-factory');
var UserState = require('../static_arch/user_state')
var Nationalities = require('../static_arch/nationalities');

var User = mongoose.Schema({
	//fullname
    fullname             : { type: String, required: true},
	password             : { type: String},

	//default user
	role                 : { type: String, default: Roles.raw.rider.name},

	//user mail 
	//key
	email                : { type: String, required: true},
	emailVerified        : { type: Boolean, default: false},
	emailVerifiedAt      : { type: Date},

	otherEmails          : [{type: String}],
	lastEmailChange      : { type: Date},

	//usually active when email verified and is online
	active               : { type: Boolean, default: false},

	mobileNumber         : { type: String},

	//driver image
	image                : { type: mongoose.Schema.Types.Mixed},

	//password reset
	passwordResetsCount  : { type: Number, default:0},
	lastPasswordResetAt  : { type: Date},
	nextResetAt          : { type: Date},

	nationality          : { type: String},
	isEgyptian           : { type: Boolean, default: false},

	//for pagination
	state                : { type: String, default: UserState.staging},
	
	//for queries 
	//if offline or injourney can not make journey
	canMakeJourney       : { type: Boolean, default: false},
	inJourney            : { type: Boolean, default: false},
	offline              : { type: Boolean, default: false},
	deleted              : { type: Boolean, default: false},
	offlineByHigherRank	 : false,
	onOffAt              : {  type: Date, default: Date.now},
	offlineBy			 : { type: mongoose.Schema.Types.ObjectId,ref: 'User'},
	deletedBy			 : { type: mongoose.Schema.Types.ObjectId,ref: 'User'},
	deletedAt            : { type: Date},
	recoveredBy			 : { type: mongoose.Schema.Types.ObjectId,ref: 'User'},
	recoveredAt            : { type: Date},
	//fcm push notification id
	pushId               : { type: String},

	updatedAt            : { type: Date, default: Date.now},
	createdAt            : { type: Date, default: Date.now },
	createdBy            : { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
},
{ usePushEach: true });

//generatePasswordHASH
User.methods.generateHash = function(password){
	return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

//checkPasswordValidation
User.methods.isValidPassword = function(password){
	if(!this.password) return false;
	return bcrypt.compareSync(password, this.password);
};

//generateSignedTicketForUser
User.methods.getTicketData = function(){
    //add addational payload 
	var data = {};
    data._id = this._id;
    data.role = this.role;
	return data; 
}


// EMAIL VERIFICATION <<================================================

User.methods.markEmailVerified = function(){
	this.emailVerified = true;
	this.emailVerifiedAt = new Date();
	this.active = true;
}

User.methods.markEmailUnverified = function(){
	this.emailVerified = false;
	this.active = false;
	this.state = UserState.unverified;
	this.canMakeJourney = false;
}

User.methods.stateReadyToMakeJourney = function(){
	this.canMakeJourney = true;

	this.state = UserState.free
	this.inJourney = false;
	
	this.save();
}



// DDRIVER OFFLINE - ONLINE <<================================================

User.methods.offlineDriver = function(user){

	//checking if user is offlined by higher role
	if(Roles.raw[this.role].rank < Roles.raw[user.role].rank){
		this.offlineByHigherRank = true;
		this.offlineBy=user._id;
	} else {this.offlineByHigherRank = false};
	
	this.offline = true;
	this.onOffAt = new Date();
	this.state = UserState.offline;
	this.canMakeJourney = false;
	this.active = false;
	
}

User.methods.onlineDriver = function(){
	
	this.offline = false;
	this.offlineBy=undefined;
	this.onOffAt = new Date();

	if(this.emailVerified){
		this.canMakeJourney = true;
		this.active = true;
		this.state = UserState.free;
	} else {
		this.state = UserState.unverified;
	}
}

// DRIVER RIDER STATE <<================================================

User.methods.stateSearchingDriver = function(){

	this.canMakeJourney = false;

	this.state = UserState.searchingDriver;
	this.save();
}

User.methods.stateWaiting = function(){
	this.canMakeJourney = false; 
	this.state = UserState.wating;
	this.save();
}

User.methods.stateInJourney = function(){

	this.canMakeJourney = false;

	this.state = UserState.inJourney;
	this.inJourney = true;
	this.save();
}





// DRIVER <<================================================
//stage Driver 
User.methods.stageDriver  = function(obj, id){
	this.createdBy = id;
	this.role = Roles.raw.driver.name;
	this.fullname = obj.fullname; 
	this.email  = obj.email;
	this.createdAt = new Date();
	
}

//activate driver
User.methods.activateDriver = function(obj){
	this.password = this.generateHash(obj.password);
	this.mobileNumber = obj.mobileNumber;
	this.image = obj.image;
	this.markEmailVerified();
	this.stateReadyToMakeJourney();
}


// SUPERADMIN <<================================================

User.methods.addSuperadmin = function(obj){
	this.role     = Roles.raw.superadmin.name;
	this.email    = obj.email;
	this.fullname = obj.fullname;
	this.password = this.generateHash(obj.password);
	this.markEmailVerified();
	
}

// ADMIN <<================================================

User.methods.stageAdmin = function(obj, id){
	this.createdBy  = id;
	this.role       = Roles.raw.admin.name;
	this.email      = obj.email;
	this.fullname   = obj.fullname; 
	this.createdAt  = new Date();
	this.markEmailVerified();
}

// SUPERVISOR <<================================================

User.methods.stageSupervisor = function(obj, id){
	this.createdBy   = id;
	this.role        = Roles.raw.supervisor.name; 
	this.email       = obj.email;
	this.fullname    = obj.fullname; 
	this.createdAt   = new Date();
	this.markEmailVerified();
}


// ACTIVATE SUPERVISOR AND ADMIN <<================================================

User.methods.activateStaff = function(password){
	this.password = this.generateHash(password);
}

//for rider
User.methods.createUser= function(obj){
	this.fullname            = obj.fullname;
	this.email               = obj.email;
	this.nationality         = obj.nationality;
	if(obj.mobileNumber){
		this.mobileNumber    = obj.mobileNumber;
	}
	if(this.nationality == Nationalities.Egyptian) { 
		this.isEgyptian = true;
	} else {
		this.isEgyptian=false;
	}
	this.password            = this.generateHash(obj.password);
}

User.methods.abusingReset = function(){
	if(this.passwordResetsCount>0 && (new Date(this.nextResetAt))> (new Date())){
		return true;
	}return false;
}

User.methods.updatePassword = function(newPassword){
	this.password = this.generateHash(newPassword);
	this.passwordResetsCount++;
	this.lastPasswordResetAt =  new Date();
	this.nextResetAt = timeFactory.cal('add', Config.timeBetweenPasswordResetsInHours, 'hours', new Date());
}


//checkPasswordValidation
User.methods.isValidPassword = function(password){
	if(!this.password) return false;
	console.log(`checking that ${password} = ${this.password}`)
	return bcrypt.compareSync(password, this.password);
};

//generateSignedTicketForUser
User.methods.getTicketData = function(){
    //add addational payload 
	var data = {};
    data._id = this._id;
    data.role = this.role;
	return data;
}

User.methods.updatePushId = function(pushId){
	this.pushId = pushId;
}

User.methods.updateProfile = function(obj){
	if(obj.mobileNumber){
		this.mobileNumber = obj.mobileNumber;
	} 
	if(obj.fullname){
		this.fullname = obj.fullname;
	}
	if(obj.email){
		console.log("x33x=> object has email => " + JSON.stringify(obj));
		this.otherEmails.push(this.email);
		this.lastEmailChange = new Date();
		this.email = obj.email;
		this.markEmailUnverified();
	}
},
User.methods.deleteDriver =function(user){
	this.canMakeJourney = false;
	this.offline = true;
	this.active = false;
	this.deletedBy=user._id;
	this.deleted=true;
	this.deletedAt=new Date();
	this.recoveredAt=undefined;
	this.recoveredBy=undefined;
},
User.methods.recoverDriver =function(user){
	this.canMakeJourney = true;
	this.offline = false;
	this.active = true;
	this.deleted=false;
	this.recoveredBy=user._id;
	this.recoveredAt=new Date();
},

User.pre('save', function(next) {
	this.updatedAt = new Date();
	next();
});

module.exports = mongoose.model('User', User);