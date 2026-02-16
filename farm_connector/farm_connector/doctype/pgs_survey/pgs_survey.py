# Copyright (c) 2026, mohamed elsawy and contributors
# For license information, please see license.txt

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
		items: DF.Table[PGSSurveyItem]
		naming_series: DF.Literal["PGS-.YYYY.-.MM.-.DD.-.####"]
		template: DF.Link
	# end: auto-generated types
	def validate(self):
		self.validate_mandatory()
		self.validate_numeric_types()
		self.calculate_formulas()

	def validate_mandatory(self):
		# Build context for evaluating expressions
		context = {}
		for i in self.items:
			var_name = i.field_label.lower().replace(" ", "_").replace("-", "_")
			val = i.reading_value
			try:
				if i.field_type in ["Int", "Float"] or (val and str(val).replace('.','',1).replace('-','',1).isdigit()):
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

	def validate_numeric_types(self):
		for item in self.items:
			if item.reading_value:
				if item.field_type == "Int":
					try:
						cint(item.reading_value)
					except:
						frappe.throw(f"Row {item.idx}: {item.field_label} must be an Integer")
				elif item.field_type == "Float":
					try:
						flt(item.reading_value)
					except:
						frappe.throw(f"Row {item.idx}: {item.field_label} must be a Number")

	def is_item_visible(self, item):
		if not item.display_depends_on:
			return True

		# Build context with all field values
		context = {}
		for i in self.items:
			var_name = i.field_label.lower().replace(" ", "_").replace("-", "_")
			val = i.reading_value

			try:
				if i.field_type in ["Int", "Float"] or (val and str(val).replace('.','',1).replace('-','',1).isdigit()):
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
				if item.field_type in ["Int", "Float"] or (val and val.replace('.','',1).isdigit()):
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
	return {
		"items": [
			{
				"section": item.section,
				"field_label": item.field_label,
				"fieldname": item.fieldname,
				"field_type": item.field_type,
				"is_mandatory": item.is_mandatory,
				"options": item.options,
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
