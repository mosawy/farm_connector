"""
Farm Connector API Endpoints
Provides REST API endpoints for the Farm Connector PWA
"""

import frappe
import json


@frappe.whitelist()
def get_assigned_forms():
	print("dsfjh")
	"""
	Get forms assigned to the current user
	Returns forms, projects, and farm locations for offline caching
	
	Returns:
		dict: {
			"forms": List of form assignments,
			"projects": List of unique projects,
			"farm_locations": List of farm coordinates for tile pre-download
		}
	"""
	user = frappe.session.user
	
	# Get form assignments for this user
	assignments = frappe.get_all(
		'Form Assignment',
		filters={
			'user': user,
			'status': ['in', ['Pending', 'In Progress']]
		},
		fields=[
			'name',
			'doctype_name',
			'description',
			'assigned_date',
			'due_date',
			'status',
			'project',
			'location'
		],
		order_by='assigned_date desc'
	)
	
	# Build forms list with unique DocTypes
	forms = []
	seen_doctypes = set()
	projects_set = set()
	
	for assignment in assignments:
		doctype_name = assignment.get('doctype_name')
		project = assignment.get('project')
		
		# Add to forms list if not already added
		if doctype_name and doctype_name not in seen_doctypes:
			forms.append({
				'doctype': doctype_name,
				'title': doctype_name,
				'project': project
			})
			seen_doctypes.add(doctype_name)
		
		# Collect unique projects
		if project:
			projects_set.add(project)
	
	# Build projects list
	projects = [{'id': p, 'name': p} for p in projects_set]
	
	# Get farm locations for tile pre-download
	farm_locations = []
	
	for assignment in assignments:
		loc_data = {}
		
		# 1. Check Form Assignment 'location' (Primary)
		if assignment.get('location'):
			try:
				# location field is likely a GeoJSON string or dict from Geolocation field
				loc_val = assignment.get('location')
				if isinstance(loc_val, str):
					loc_val = json.loads(loc_val)
				
				# Extract coordinates from GeoJSON
				if isinstance(loc_val, dict) and 'features' in loc_val:
					# FeatureCollection
					geometry = loc_val['features'][0]['geometry']
				elif isinstance(loc_val, dict) and 'geometry' in loc_val:
					# Feature
					geometry = loc_val['geometry']
				elif isinstance(loc_val, dict) and 'coordinates' in loc_val:
					# Geometry
					geometry = loc_val
				else:
					geometry = None
					
				if geometry and 'coordinates' in geometry:
					coords = geometry['coordinates']
					# Handle Point or Polygon
					if geometry['type'] == 'Point':
						loc_data = {'lat': coords[1], 'lng': coords[0]}
					elif geometry['type'] == 'Polygon':
						# Use first point of polygon as center/reference
						loc_data = {'lat': coords[0][0][1], 'lng': coords[0][0][0]}
			except Exception:
				pass
		
		# 2. If no location in assignment, check the Target Document
		if not loc_data:
			try:
				doctype = assignment.get('doctype_name')
				name = assignment.get('name') # This is assignment name, need linked doc name??
				# Wait, 'Form Assignment' usually doesn't store the linked doc name if it's new.
				# But for existing forms (e.g. Visit), it might link to a Farm.
				# The current code in 'assignments' has 'name' which is the assignment name.
				# We don't have the linked document name in the assignment list unless we fetch it.
				# Let's check api.py lines 27-44. It fetches 'name', 'doctype_name', 'project', 'location'.
				# It does NOT fetch the linked document name.
				# So we can effectively only check the Project as fallback if Assignment has no location.
				pass
			except Exception:
				pass

		# 3. Fallback to Project Location
		if not loc_data and assignment.get('project'):
			try:
				project_name = assignment.get('project')
				# Check if project has location fields
				if frappe.db.exists('Project', project_name):
					# Try generic fields
					proj = frappe.db.get_value('Project', project_name, ['latitude', 'longitude', 'location'], as_dict=True)
					if proj:
						if proj.get('latitude') and proj.get('longitude'):
							loc_data = {'lat': proj.get('latitude'), 'lng': proj.get('longitude')}
			except Exception:
				pass
		
		# Add if we found a location
		if loc_data:
			farm_locations.append({
				'id': assignment.get('name'), # Use assignment Name as ID
				'name': assignment.get('description') or assignment.get('doctype_name'),
				'lat': loc_data['lat'],
				'lng': loc_data['lng']
			})

	
	return {
		'forms': forms,
		'projects': projects,
		'farm_locations': farm_locations,
		'assignments': assignments  # Include original assignments for backward compatibility
	}


@frappe.whitelist()
def get_doctype_fields(doctype):
	"""
	Get field metadata for a DocType
	Similar to hrms.api.get_doctype_fields
	
	Args:
		doctype (str): Name of the DocType
	
	Returns:
		list: List of field definitions
	"""
	# Check if user has permission to access this DocType
	if not frappe.has_permission(doctype, "read"):
		frappe.throw(f"No permission to access {doctype}", frappe.PermissionError)
	
	meta = frappe.get_meta(doctype)
	
	fields = []
	for field in meta.fields:
		fields.append({
			'fieldname': field.fieldname,
			'label': field.label,
			'fieldtype': field.fieldtype,
			'options': field.options,
			'reqd': field.reqd,
			'read_only': field.read_only,
			'hidden': field.hidden,
			'depends_on': field.depends_on,
			'description': field.description,
			'default': field.default,
			'length': field.length,
			'precision': field.precision
		})
	
	return fields


@frappe.whitelist()
def get_nearby_polygons(lat=None, lng=None, radius_km=5, project_id=None, limit=500, doctype_name=None):
	"""
	Get nearby farm polygons for overlap detection
	Returns GeoJSON FeatureCollection format
	
	Args:
		lat (float): Center latitude
		lng (float): Center longitude
		radius_km (float): Radius in kilometers (default 5km)
		project_id (str): Optional project filter
		limit (int): Maximum number of results (default 500)
		doctype_name (str): DocType to query
	
	Returns:
		dict: GeoJSON FeatureCollection with polygon features
	"""
	# If no doctype specified, return empty result
	if not doctype_name:
		return {
			"type": "FeatureCollection",
			"features": []
		}

	# Check if DocType exists
	if not frappe.db.exists("DocType", doctype_name):
		# Instead of throwing, just return empty features.
		# This handles cases where an assignment exists for a deleted DocType.
		return {
			"type": "FeatureCollection",
			"features": []
		}
	
	# Build filters
	filters = {}
	
	if project_id:
		filters['project'] = project_id
	
	# Get meta to check which fields exist
	meta = frappe.get_meta(doctype_name)
	field_names = [f.fieldname for f in meta.fields]
	
	# Build field list based on what exists in the DocType
	fields = ['name']
	
	# Common field mappings (Frappe field -> PWA field)
	# Prioritize 'polygon' as the primary field name for geometry
	field_mapping = {
		'farm_name': 'farm_name',
		'title': 'farm_name',
		'owner_name': 'owner_name',
		'status': 'status',
		'polygon': 'polygon_geojson',  # Primary polygon field (used by frontend app)
		'location': 'polygon_geojson', # Standard Geolocation field
		'polygon_geojson': 'polygon_geojson',
		'geojson': 'polygon_geojson',
		'geometry': 'polygon_geojson',  # Fallback for standard GeoJSON field
		'area_hectares': 'area_hectares',
		'area': 'area_hectares',
		'center_latitude': 'center_latitude',
		'latitude': 'center_latitude',
		'center_longitude': 'center_longitude',
		'longitude': 'center_longitude',
		'project': 'project'
	}
	
	# Add fields that exist in the DocType
	for field_name in field_mapping.keys():
		if field_name in field_names and field_name != 'name':
			fields.append(field_name)
	
	# Get records
	records = frappe.get_all(
		doctype_name,
		filters=filters,
		fields=fields,
		limit=limit
	)
	
	# Build GeoJSON FeatureCollection
	features = []
	
	for record in records:
		# Get mapped field values
		mapped_data = {'name': record.get('name')}
		for frappe_field, pwa_field in field_mapping.items():
			if frappe_field in record:
				mapped_data[pwa_field] = record[frappe_field]
		
		# Filter by bounding box if coordinates provided
		if lat and lng and mapped_data.get('center_latitude') and mapped_data.get('center_longitude'):
			lat_delta = float(radius_km) / 111  # ~111km per degree
			lng_delta = float(radius_km) / (111 * abs(float(lat)) * 0.017453)
			
			min_lat = float(lat) - lat_delta
			max_lat = float(lat) + lat_delta
			min_lng = float(lng) - lng_delta
			max_lng = float(lng) + lng_delta
			
			center_lat = mapped_data['center_latitude']
			center_lng = mapped_data['center_longitude']
			
			if not (min_lat <= center_lat <= max_lat and min_lng <= center_lng <= max_lng):
				continue
		
		# Parse GeoJSON geometry
		geometry = None
		geojson_field = mapped_data.get('polygon_geojson')
		
		if geojson_field:
			try:
				# If it's a string, parse it
				if isinstance(geojson_field, str):
					geojson_obj = json.loads(geojson_field)
				else:
					geojson_obj = geojson_field
				
				# Extract geometry if it's a Feature or FeatureCollection
				if isinstance(geojson_obj, dict):
					if geojson_obj.get('type') == 'FeatureCollection' and geojson_obj.get('features'):
						# Use geometry of first feature
						geometry = geojson_obj['features'][0]['geometry']
					elif geojson_obj.get('type') == 'Feature':
						geometry = geojson_obj.get('geometry')
					else:
						# Assume it's a geometry object or valid dict
						geometry = geojson_obj
						
			except (json.JSONDecodeError, TypeError, IndexError):
				# If parsing fails, skip this polygon
				continue
		
		# Build GeoJSON Feature
		feature = {
			"type": "Feature",
			"id": mapped_data.get('name'),
			"properties": {
				"name": mapped_data.get('name'),
				"owner_name": mapped_data.get('owner_name'),
				"status": mapped_data.get('status', 'unverified'),
				"area_hectares": mapped_data.get('area_hectares'),
				"project": mapped_data.get('project'),
				"center_lat": mapped_data.get('center_latitude'),
				"center_lng": mapped_data.get('center_longitude')
			},
			"geometry": geometry
		}
		
		features.append(feature)
	
	# Return GeoJSON FeatureCollection
	return {
		"type": "FeatureCollection",
		"features": features
	}


@frappe.whitelist()
def mark_assignment_in_progress(assignment_name):
	"""
	Mark a form assignment as in progress
	
	Args:
		assignment_name (str): Name of the Form Assignment
	"""
	doc = frappe.get_doc('Form Assignment', assignment_name)
	
	if doc.user != frappe.session.user:
		frappe.throw("You can only update your own assignments", frappe.PermissionError)
	
	if doc.status == 'Pending':
		doc.status = 'In Progress'
		doc.save(ignore_permissions=True)
	
	return {'status': 'success'}


@frappe.whitelist()
def mark_assignment_completed(assignment_name):
	"""
	Mark a form assignment as completed
	
	Args:
		assignment_name (str): Name of the Form Assignment
	"""
	doc = frappe.get_doc('Form Assignment', assignment_name)
	
	if doc.user != frappe.session.user:
		frappe.throw("You can only update your own assignments", frappe.PermissionError)
	
	doc.status = 'Completed'
	doc.completed_date = frappe.utils.today()
	doc.save(ignore_permissions=True)
	
	return {'status': 'success'}
