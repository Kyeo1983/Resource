var User = require('../models/user.js');
var Movie = require('../models/movie.js');
var Rating = require('../models/rating.js');
var config = require('../../config.js');
var secretKey = config.secretKey;


var jsonwebtoken = require('jsonwebtoken');
function createToken(user) {
	var token = jsonwebtoken.sign({
		id: user._id,
		name: user.name,
		username: user.username
	}, secretKey, { expiresInMinutes: 1440 });
	
	return token;
}


/**
* APIs for all required services.
* @module API
*/
var API = function(app, express, io) {

	var api = express.Router();
	
	
	/* Sign up new users */
	api.post('/signup', function(req, res){
		var user = new User({
			name: req.body.name,
			username: req.body.username,
			password: req.body.password
		});
		
		var token = createToken(user);
		
		
		user.save(function(err){
			if (err) {
				res.send(err);
				return;
			}
			res.json({
				success: true,
				message: 'User has been created!' ,
				token:	token
			});
		})
	});
	
	
	/* Get all existing users *
	api.get('/users', function(req, res) {
		User.find({}, function(err, users){
			if (err) {
				res.send(err);
				return;
			}
			res.json(users);
		}); /* mongoose function to find all *
	});
	
	
	/* Log in */
	api.post('/login', function(req, res){		
		User.findOne({ 
			username: req.body.username
		}).select('name username password').exec(function(err, user) {
			if (err) throw err;
			if (!user) res.send({ message: "User doesn't exist" });
			else {
				var validPassword = user.comparePassword(req.body.password);
				if (!validPassword) res.send({ message: "Invalid Password" });
				else {
					////// token
					var token = createToken(user);
					res.json({
						success: true,
						message: 'Successfully login!',
						token: token
					});
				}
			}
				
		}); 
	});
	
	
	
	/* Get a specific movie */
	api.get('/getMovie', function(req, res) {
		var movieId = req.query.id;
		var movieTitle = req.query.title;
		var movieYear = parseInt(req.query.year);
		
		var params = { _id: movieId };
		if (!movieId) params = { title: movieTitle, year: movieYear };
		Movie.findOne(params).exec(function(err, movie){
			if (err) {	
				res.send(err);
				return;
			}
			res.json(movie);
		});
	});
	/* Get next alphabetically sorted movie */
	api.get('/getNextMovie', function(req, res) {
		var movieTitle = req.query.title;
		var direction = req.query.direction;
		
		var search_dir = { $gt: movieTitle };
		if (direction == -1) search_dir = { $lt: movieTitle };
					
		Movie.findOne({title: search_dir}).sort({title: direction})
			.exec(function(err, movie){
				var data = { message: '', movie: movie };
				
				if (err) {
					data.message = err;
					res.send(data);
					return;
				}
				
				if (!movie) { // at end of list, no more movies in front or behind
					data.message = 'End of list';
					res.send( data );
					return;
				}
				res.json(data);
			});
	});
	
	
	/* 	Middleware - Acts as a bridge between 1 destination and another 
		In usual case, on every page this middleware will check if the user
		is already logged-in by checking the token.
		
		All api above this api.use() function are before the middleware, ungoverned.
		All api after are governed and requires user to be logged in.
	*/
	api.use(function(req, res, next) {
		var token = req.body.token || req.param.token || req.headers['x-access-token'];

		// check if token exists
		if (token) {
			jsonwebtoken.verify(token, secretKey, function(err, decoded){				
				if (err) { 
					res.status(403).send({ success: false, message: 'Failed to authenticate user.' })}
				else {
					req.decoded = decoded;
					next();
				}
			});
		}
		else {
			res.status(403).send({ success: false, message: 'No token provided.' });
		}
	});
	
	
	/**
	* Callback function that returns a list of all movies.
	* @callback API~cb_allMovies
	* @param {req} HTTPRequest
	* @param {res} HTTPResponse
	* @exception Returns error message in response body if error.
	*/
	var cb_allMovies = function(req, res) {
		Movie.find({}, function(err, movies){
			if (err) {
				res.send(err);
				return;
			}
			res.json(movies);
		});
	}
	/**
	 * Web API to get all movies.
	 * @param {callback} cb_allmovies - Callback function that handles retrieval of all movies.
	 */
	api.get('/allMovies', cb_allMovies);
	
	
	
	/**
	* Callback function that creates a new movie data.
	* @callback API~cb_createMovie
	* @param {req} HTTPRequest with body containing new movie's content data
	* @param {res} HTTPResponse
	* @exception Returns error message in response body if movie already exists or if error.
	*/
	var cb_createMovie = function(req, res){
		var movieData = new Movie({
			title: req.body.title,
			year: req.body.year,
			url: req.body.url
		});
			

		Movie.findOne({ 
			title: req.body.title,
			year: req.body.year
		}).exec(function(err, movie) {
			if (err) {
				throw err;				
			}
			else if (movie) {
				res.json({ message: 'Movie already exists!' });
				return;
			}
			else {				
				movieData.save(function(err, newMovie) {
					if (err) {
						res.send(err);
						return;
					}
					// io.emit('story', newStory);
					res.json({ message: 'New movie created!' });
				});
			}
		});				
	};	
	/**
	 * Web API to create a new movie data.
	 * @param {callback} cb_createMovie - Callback function that handles creation of a new movie data.
	 */
	api.post('/createMovie', cb_createMovie);
	
	
	
	
	/**
	* Callback function that applies a rating to a movie.
	* @callback API~cb_rateMovie
	* @param {req} HTTPRequest, body containing either the movie ID (movieId) property or the title (movieTitle) and year (movieYear) properties.
	* @param {res} HTTPResponse
	* @exception Returns error message in response body if error.
	*/
	var cb_rateMovie = function(req, res) {
		var movieId = req.body.movieId;
		var movieTitle = req.body.movieTitle;
		var movieYear = parseInt(req.body.movieYear);
		
		var params;
		if (movieId) params = { _id : movieId };
		else params = { title: movieTitle, year: movieYear };
		
		// Check if movie exists
		Movie.findOne( params , function(err, movie){
			if (err) {
				res.send(err);
				return;
			}
			else {			
				var ratingData = {
					rater: req.decoded.id,
					movie: movie._id,
					rating: req.body.rating
				};	

				// Check if rating already exists
				params = {
					rater: req.decoded.id,
					movie: movie._id,
				};
				Rating.update( 
					params, 
					{ $set: ratingData },
					{ upsert: true },
					function(err){
						if (err) {
							res.send(err);
							return;
						}
						
						// io.emit('story', newStory);
						res.json({ message: 'New rating applied!' });
					}
				);
			}
		});
	}
	/**
	 * Web API to apply a rating to a movie.
	 * @param {callback} cb_rateMovie - Callback function that handles applying a rating to a movie.
	 */
	api.post('/rateMovie', cb_rateMovie);
	
	
	/**
	* Callback function that retrieves a rating on a movie.
	* @callback API~cb_getRating
	* @param {req} HTTPRequest, body containing either the movie ID (movieId) property or the title (movieTitle) and year (movieYear) properties.
	* @param {res} HTTPResponse
	* @exception Returns error message in response body if error.
	*/
	var cb_getRating = function(req, res) {
		var movieId = req.query.id;
		var movieTitle = req.query.title;
		var movieYear = parseInt(req.query.year);
	
		var params;
		if (!movieId) {
			params = { title: movieTitle, year: movieYear };
			Movie.findOne( params , function(err, movie){
				if (err) {
					res.send(err);
					return;
				}
				getRatingByID(movie._id, req, res);
			});
		}
		else getRatingByID(movieId, req, res);	
	}	
	/**
	 * Inner method to get existing rating to a movie by the movie ID and the currently authenticated user.
	 * @param {string} movieID - ID of the movie
	 */
	var getRatingByID = function(movieId, req, res){
		params = { movie: movieId, rater : req.decoded.id };
		Rating.findOne( params, function(err, ratingData) {
			if (err) {
				res.send(err);
				return;
			}
			else res.json(ratingData);
		});
	}
	/**
	 * Web API to get an existing rating to a movie.
	 * @param {callback} cb_getRating - Callback function that handles geting a rating on a movie.
	 */
	api.get('/getRating', cb_getRating);
	
	
	/* Chaining method used here will handle multiple http methods on a single route *
	api.route('/')
		.post(function(req, res){
			var story = new Story({
				creator: req.decoded.id,
				content: req.body.content
			});
			
			story.save(function(err, newStory) {
				if (err) {
					res.send(err);
					return;
				}
				io.emit('story', newStory);
				res.json({ message: 'New story created!' });
			});
		})
		.get(function(req, res){
			Story.find({ creator: req.decoded.id }, function(err, stories) {
				if (err) {
					res.send(err);
					return;
				}		

				res.json(stories);
			})
		});
	*/
	
	
	/**
	* Returns in response's body the decoded user data. Middleware does not return user data to Frontend libraries like Angular. Frontend may call this API to get the decoded user data.
	* @param {req} HTTPRequest
	* @param {res} HTTPResponse
	*/
	api.get('/me', function(req, res){
		res.json(req.decoded);
	});
	
	return api;
}
module.exports = API;
