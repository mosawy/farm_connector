# Copyright (c) 2026, mohamed elsawy and contributors
# For license information, please see license.txt

import re

import frappe
from frappe.model.document import Document
from frappe.utils import flt, cint

class PGSSurvey(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from farm_connector.farm_connector.doctype.pgs_survey_item.pgs_survey_item import PGSSurveyItem

		amended_from: DF.Link | None
		category: DF.Literal["", "Pre-Germination", "Post-Harvest", "Soil Analysis", "Crop Health", "General"]
		form_assignment: DF.Link | None
		items: DF.Table[PGSSurveyItem]
		naming_series: DF.Literal["PGS-.YYYY.-.MM.-.DD.-.####"]
		template: DF.Link
	# end: auto-generated types
	def validate(self):
		self.validate_template_submitted()
		self.validate_mandatory()
		self.validate_field_types()
		self.calculate_formulas()

	def validate_template_submitted(self):
		if self.template:
			docstatus = frappe.db.get_value("PGS Template", self.template, "docstatus")
			if docstatus != 1:
				frappe.throw(f"Template '{self.template}' must be submitted before it can be used in a survey.")

	NUMERIC_FIELD_TYPES = ["Int", "Float", "Currency", "Percent", "Rating"]

	def validate_mandatory(self):
		# Build context for evaluating expressions
		context = {}
		for i in self.items:
			var_name = i.field_label.lower().replace(" ", "_").replace("-", "_")
			val = i.reading_value
			try:
				if i.field_type in self.NUMERIC_FIELD_TYPES or (val and str(val).replace('.','',1).replace('-','',1).isdigit()):
					val = flt(val)
			except:
				pass
			context[var_name] = val
			context[i.field_label] = val

		for item in self.items:
			# Skip if item is not visible
			if not self.is_item_visible(item):
				continue

			# Check if field is mandatory
			is_required = item.is_mandatory

			# Check conditional mandatory
			if item.mandatory_depends_on:
				try:
					is_required = is_required or bool(frappe.safe_eval(item.mandatory_depends_on, None, context))
				except Exception as e:
					frappe.log_error(f"Mandatory dependency error for {item.field_label}: {e}")

			if is_required and not item.reading_value and not item.attachment:
				frappe.throw(f"Row {item.idx}: {item.field_label} is mandatory")

	def validate_field_types(self):
		"""Validate field values based on their declared field types."""
		from frappe.utils import getdate, get_datetime

		for item in self.items:
			if not item.reading_value:
				continue

			val = item.reading_value
			ft = item.field_type

			if ft == "Int":
				try:
					cint(val)
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be an Integer")

			elif ft == "Float":
				try:
					flt(val)
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a Number")

			elif ft == "Currency":
				try:
					flt(val)
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid currency amount")

			elif ft == "Percent":
				try:
					pct = flt(val)
					if pct < 0 or pct > 100:
						frappe.throw(f"Row {item.idx}: {item.field_label} must be between 0 and 100")
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid percentage")

			elif ft == "Rating":
				try:
					r = cint(val)
					if r < 0 or r > 5:
						frappe.throw(f"Row {item.idx}: {item.field_label} must be between 0 and 5")
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid rating (0-5)")

			elif ft == "Date":
				try:
					getdate(val)
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid date (YYYY-MM-DD)")

			elif ft == "Datetime":
				try:
					get_datetime(val)
				except Exception:
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid datetime")

			elif ft == "Time":
				if not re.match(r'^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$', val):
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid time (HH:MM or HH:MM:SS)")

			elif ft == "Color":
				if not re.match(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$', val):
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid hex color (e.g. #FF0000)")

			elif ft == "Phone":
				if not re.match(r'^[\d\s\+\-\(\)]+$', val):
					frappe.throw(f"Row {item.idx}: {item.field_label} must be a valid phone number")

			elif ft == "Link":
				if item.link_doctype and val:
					if not frappe.db.exists(item.link_doctype, val):
						frappe.throw(f"Row {item.idx}: {item.field_label} - '{val}' does not exist in {item.link_doctype}")

	def is_item_visible(self, item):
		if not item.display_depends_on:
			return True

		# Build context with all field values
		context = {}
		for i in self.items:
			var_name = i.field_label.lower().replace(" ", "_").replace("-", "_")
			val = i.reading_value

			try:
				if i.field_type in self.NUMERIC_FIELD_TYPES or (val and str(val).replace('.','',1).replace('-','',1).isdigit()):
					val = flt(val)
			except:
				pass

			context[var_name] = val
			context[i.field_label] = val

		try:
			result = frappe.safe_eval(item.display_depends_on, None, context)
			return bool(result)
		except Exception as e:
			frappe.log_error(f"Display dependency error for {item.field_label}: {e}")
			return True  # Show field if expression fails

	def calculate_formulas(self):
		# Map values to labels for formula context
		values = {}
		for item in self.items:
			val = item.reading_value
			try:
				if item.field_type in self.NUMERIC_FIELD_TYPES or (val and val.replace('.','',1).isdigit()):
					val = flt(val)
			except:
				pass

			values[item.field_label] = val
			key = item.field_label.lower().replace(" ", "_")
			values[key] = val

		# Apply formulas
		for item in self.items:
			if item.formula:
				try:
					result = frappe.safe_eval(item.formula, None, values)
					item.reading_value = str(result)

					# Update context for subsequent formulas
					values[item.field_label] = result
					key = item.field_label.lower().replace(" ", "_")
					values[key] = result
				except Exception as e:
					frappe.log_error(f"Formula Error in {item.field_label}: {e}")

@frappe.whitelist()
def get_template_details(template_name):
	template = frappe.get_doc("PGS Template", template_name)
	if template.docstatus != 1:
		frappe.throw(f"PGS Template '{template_name}' is not submitted. Only submitted templates can be used.")
	return {
		"items": [
			{
				"section": item.section,
				"field_label": item.field_label,
				"fieldname": item.fieldname,
				"field_type": item.field_type,
				"is_mandatory": item.is_mandatory,
				"options": item.options,
				"link_doctype": item.link_doctype,
				"formula": item.formula,
				"allow_multiple": item.allow_multiple,
				"help_text": item.help_text,
				"display_depends_on": item.display_depends_on,
				"mandatory_depends_on": item.mandatory_depends_on
			}
			for item in template.items
		],
		"section_order": template.section_order
	}
