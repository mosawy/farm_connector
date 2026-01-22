# Copyright (c) 2026, mohamed elsawy and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FormAssignment(Document):
	def validate(self):
		"""Validate the form assignment"""
		# Verify that the DocType exists
		if not frappe.db.exists("DocType", self.doctype_name):
			frappe.throw(f"DocType '{self.doctype_name}' does not exist")
	
	def on_update(self):
		"""Update completed date when status changes to Completed"""
		if self.status == "Completed" and not self.completed_date:
			self.db_set("completed_date", frappe.utils.today())
